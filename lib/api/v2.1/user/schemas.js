'use strict';

const joi = require('joi');
const { values } = require('ramda');

const { UserRoleEnum } = require('../../../enums');

const UserSchema = joi.object({
  id: joi.string().required(),
  username: joi.string().required(),
  email: joi.string().email().required(),
  alerts: joi.bool().required(),
  totpAuthEnabled: joi.bool(),
  role: joi.string().valid(...values(UserRoleEnum)),
}).label('User');

const ProfileSchema = joi.object({
  userId: joi.string().required(),
  presentationMode: joi.bool().required(),
  forceChangePassword: joi.bool().required(),
  tableConfig: joi.object().allow(null),
  lastLogItemId: joi.string().optional().allow(null),
}).label('UserProfile');

const TwoFactorToken = joi.object({
  id: joi.string().required(),
  userId: joi.string().required(),
  sessionTimeout: joi.number(),
  exp: joi.number().required(),
}).unknown().label('TwoFactorToken');

const TwoFactorSecret = joi.object({
  base32: joi.string().label('otp secret in base32 encoding'),
  otpauth_url: joi.string().label('otp secret url for authenticator app'),
}).label('TwoFactorSecret');

module.exports = {
  UserSchema,
  ProfileSchema,
  TwoFactorToken,
  TwoFactorSecret,
};
