'use strict';

const { Observable } = require('rxjs/Rx');
const { Reader: reader, Either } = require('monet');
const { chain, path, filter, pathOr, gt, when, reduce, maxBy, ifElse, pathSatisfies } = require('ramda');
const { cata, isNotNil } = require('ramda-adjunct');
const { flow, constant } = require('lodash/fp');
const moment = require('moment-timezone');
const rp = require('request-promise-native');

require('../../../util/observable');
const config = require('../../../../config');
const { allP, rejectP, resolveP, tapP } = require('../../../util');
const { testSmtpAuthSettings } = require('../../../util/smtp');
const { merge: mergeM } = require('../../../transformers');
const {
  toApiNmsSummary, fromDbNmsSummary, fromDbNms, fromApiSmtp, toApiSmtp, toDbNms, fromDbNmsSettings, toApiNmsSettings,
  fromApiNmsSettings,
} = require('../../../transformers/nms');
const { mergeSmtpSettings, mergeNmsSettings, mergeFirmwaresUnreadCount } = require('../../../transformers/nms/mergers');


/*
 * Get NMS settings
 */

const getNmsSettings = () => reader(
  ({ settings }) => settings.loadSettings()
    .then(settings.getSettings)
    .then(fromDbNmsSettings({}))
    .then(chain(toApiNmsSettings))
    .then(cata(rejectP, resolveP))
);

/*
 * Update NMS settings
 */

const updateNmsSettings = nmsSettings => reader(
// eslint-disable-next-line no-unused-vars
  ({ messageHub, DB, nginx: { updateSslCertificate }, settings }) => Observable.from(DB.nms.get())
    .mergeEither(fromDbNms({}))
    .mergeEither(mergeM(mergeNmsSettings, fromApiNmsSettings({}, nmsSettings)))
    .mergeEither(toDbNms)
    .mergeMap(dbSettings => DB.nms.update(dbSettings))
    .do(() => messageHub.publish(messageHub.messages.settingsChanged()))
    .mergeMap(() => getNmsSettings().run({ settings }))
    .toPromise()
    .then(tapP(() => updateSslCertificate(nmsSettings.useLetsEncrypt)))
);

/*
 * Get NMS summary
 */

const getSummary = ({ outagesTimestamp, logsTimestamp, logsLevel, firmwaresTimestamp }) => reader(
  ({ DB, deviceStore, apiLogs, apiDevices, apiOutages, apiFirmwares }) => allP([
    apiLogs.countUnread({ timestamp: logsTimestamp, level: logsLevel }),
    apiOutages.countUnread({ timestamp: outagesTimestamp }),
    apiDevices.countUnauthorizedDevices().run({ DB, deviceStore }),
    apiFirmwares.countUnread({ timestamp: firmwaresTimestamp }),
  ])
  .then(([logsUnreadCount, outagesUnreadCount, devicesUnauthorizedCount, firmwaresUnreadCount]) =>
    fromDbNmsSummary({}, { logsUnreadCount, outagesUnreadCount, devicesUnauthorizedCount })
      .chain(mergeM(mergeFirmwaresUnreadCount, Either.Right({ firmwaresUnreadCount })))
      .chain(toApiNmsSummary)
      .cata(rejectP, resolveP)
  )
);

/*
 * Update SMTP settings
 */

const updateSmtp = smtpSettings => reader(
  ({ DB }) => testSmtpAuthSettings(smtpSettings)
    .then(() => DB.nms.get())
    .then(fromDbNms({}))
    .then(chain(mergeM(mergeSmtpSettings, fromApiSmtp({}, smtpSettings))))
    .then(cata(rejectP, resolveP))
    .then(tapP(flow(toDbNms, cata(rejectP, DB.nms.update))))
    .then(toApiSmtp)
    .then(cata(rejectP, resolveP))
);

/*
 * Get UNMS news from feed
 */

const getNews = userId => reader(
  ({ userService, dal }) => Observable.forkJoin(
      userService.getUserProfile(userId).promise().then(path(['lastNewsSeenDate'])),
      rp({ uri: config.newsFeedUrl, headers: { 'User-Agent': 'Request-Promise' }, json: true, simple: false })
        .catch(constant([]))
    )
    .map(([lastSeen, newsFeed]) => when(
      isNotNil,
      filter(news => gt(pathOr(0, ['date'], news), lastSeen)),
      newsFeed
    ))
    .tapO(flow(
      reduce(maxBy(path(['date'])), { date: 0 }),
      ifElse(
        pathSatisfies(date => date > 0, ['date']),
        lastNewsSeen =>
          dal.userProfileRepository.update({ userId, lastNewsSeenDate: moment(path(['date'], lastNewsSeen)) }),
        constant(Observable.empty())
      )
    ))
    .toPromise()
);


module.exports = {
  getSummary,
  updateSmtp,
  getNmsSettings,
  updateNmsSettings,
  getNews,
};
