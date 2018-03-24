'use strict';

const joi = require('joi');
const { values } = require('ramda');
const { OK, CREATED, UNAUTHORIZED, FORBIDDEN, NOT_ACCEPTABLE, INTERNAL_SERVER_ERROR } = require('http-status');

const { ErrorSchema, StatusSchema, AuthHeaderSchema } = require('../osm');
const { UserSchema, ProfileSchema, TwoFactorToken, TwoFactorSecret } = require('./schemas');
const validation = require('../../../validation');
const { MobileDevicePlatformEnum } = require('../../../enums');

function registerRoutes(server, options, view) {
  server.route({
    method: 'GET',
    path: '/v2.1/user',
    config: {
      description: 'Get the authenticated user',
      tags: ['api', 'user'],
      validate: {
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: UserSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [NOT_ACCEPTABLE]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.getUser,
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/user',
    config: {
      description: 'Updates authenticated user',
      tags: ['api', 'user'],
      validate: {
        payload: joi.object({
          username: validation.username,
          email: joi.string().email().required(),
          currentPassword: validation.password,
          newPassword: validation.password.optional().allow(null),
        }).label('EditUser'),
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: UserSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [NOT_ACCEPTABLE]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.putUser,
  });

  server.route({
    method: 'GET',
    path: '/v2.1/user/profile',
    config: {
      description: 'Get the authenticated user profile',
      tags: ['api', 'user'],
      validate: {
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: ProfileSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.getUserProfile,
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/user/profile',
    config: {
      description: 'Get the authenticated user profile',
      tags: ['api', 'user'],
      validate: {
        payload: joi.object({
          userId: validation.userId,
          presentationMode: joi.boolean().required(),
          forceChangePassword: joi.boolean().required(),
          tableConfig: joi.object().optional().allow(null),
          lastLogItemId: joi.string().optional().allow(null),
        }).label('EditUserProfile'),
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: ProfileSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.updateUserProfile,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/login',
    config: {
      auth: false,
      description: 'Get the authenticated user profile',
      tags: ['api', 'user'],
      plugins: {
        'hapi-swagger': { security: [] },
        'hapi-rate-limit': { enabled: true },
      },
      validate: {
        payload: joi.object({
          username: validation.username,
          password: validation.password,
          sessionTimeout: validation.sessionTimeout.label('Token lifetime in milliseconds'),
        }).label('Login'),
      },
      response: {
        status: {
          [OK]: UserSchema.meta({
            headers: {
              'x-auth-token': {
                type: 'string',
                description: 'User authorization token',
              },
            },
          }).label('UserLogin'),
          [CREATED]: TwoFactorToken,
          [UNAUTHORIZED]: ErrorSchema,
          [NOT_ACCEPTABLE]: ErrorSchema,
        },
      },
    },
    handler: view.login,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/login/totpauth',
    config: {
      auth: false,
      description: 'Gets new information for two factor authentication',
      tags: ['api', 'user'],
      plugins: {
        'hapi-swagger': { security: [] },
        'hapi-rate-limit': { enabled: true },
      },
      validate: {
        payload: joi.object({
          token: validation.guidToken,
          verificationCode: validation.verificationCode.required(),
          sessionTimeout: validation.sessionTimeout.optional(),
          password: validation.password,
        }).label('Two Factor Login'),
      },
      response: {
        status: {
          [OK]: UserSchema.meta({
            headers: {
              'x-auth-token': {
                type: 'string',
                description: 'User authorization token',
              },
            },
          }).label('UserLogin'),
          [UNAUTHORIZED]: ErrorSchema,
          [NOT_ACCEPTABLE]: ErrorSchema,
        },
      },
    },
    handler: view.loginTotpAuth,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/logout',
    config: {
      description: 'Logout',
      tags: ['api', 'user'],
      validate: {
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: StatusSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.logout,
  });

  server.route({
    method: 'GET',
    path: '/v2.1/user/totpauth',
    config: {
      description: 'Gets new information for two factor authentication',
      tags: ['api', 'user'],
      validate: {
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: TwoFactorSecret,
          [UNAUTHORIZED]: ErrorSchema,
        },
      },
    },
    handler: view.getTotpAuth,
  });

  server.route({
    method: 'PUT',
    path: '/v2.1/user/totpauth',
    config: {
      description: 'Sets two factor authentication for user',
      tags: ['api', 'user'],
      validate: {
        payload: joi.object({
          password: validation.password
            .when('totpAuthEnabled', {
              is: false,
              then: validation.password.optional(),
            }),
          verificationCode: joi.string().required()
            .when('totpAuthEnabled', {
              is: false,
              then: joi.string().optional(),
            }),
          totpAuthEnabled: joi.boolean().required(),
          totpAuthSecret: joi.string().required()
            .when('totpAuthEnabled', {
              is: false,
              then: joi.string().optional(),
            }),
        }).label('EnableTotpAuth'),
        headers: AuthHeaderSchema,
      },
      response: {
        status: {
          [OK]: UserSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [FORBIDDEN]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.setTotpAuth,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/password/requestreset',
    config: {
      auth: false,
      description: 'Request password reset',
      tags: ['api', 'user'],
      plugins: {
        'hapi-swagger': { security: [] },
        'hapi-rate-limit': { enabled: true },
      },
      validate: {
        payload: joi.object({
          email: joi.string().email().required(),
        }).label('PasswordResetRequest'),
      },
      response: {
        status: {
          [CREATED]: StatusSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.requestPasswordReset,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/password/reset',
    config: {
      auth: false,
      description: 'Perform password reset',
      tags: ['api', 'user'],
      plugins: {
        'hapi-swagger': { security: [] },
        'hapi-rate-limit': { enabled: true },
      },
      validate: {
        payload: joi.object({
          token: validation.guidToken,
          password: validation.password,
        }).label('PasswordResetAction'),
      },
      response: {
        status: {
          [OK]: StatusSchema,
          [UNAUTHORIZED]: ErrorSchema,
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.resetPasswordUsingToken,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/password/strength',
    config: {
      auth: false,
      description: 'Check password strength',
      tags: ['api', 'user'],
      plugins: {
        'hapi-swagger': { security: [] },
        'hapi-rate-limit': { enabled: true },
      },
      validate: {
        payload: joi.object({
          password: validation.password,
        }).label('PasswordStrength'),
      },
      response: {
        status: {
          [OK]: joi.object({
            password: joi.string().required(),
            guesses: joi.number().required(),
            guesses_log10: joi.number().required(),
            sequence: joi.array().items(joi.object({
              pattern: joi.string().required(),
              token: joi.string().required(),
              i: joi.number().required(),
              j: joi.number().required(),
              guesses: joi.number().required(),
              guesses_log10: joi.number().required(),
              repeat: joi.number(),
              base_guesses: joi.number(),
              base_matches: joi.array().items(joi.object({
                pattern: joi.string().required(),
                token: joi.string().required(),
                i: joi.number().required(),
                j: joi.number().required(),
                guesses: joi.number().required(),
                guesses_log10: joi.number().required(),
              }).unknown()),
            }).unknown()),
            calc_time: joi.number().required(),
            crack_times_seconds: joi.object({
              online_throttling_100_per_hour: joi.number().required(),
              online_no_throttling_10_per_second: joi.number().required(),
              offline_slow_hashing_1e4_per_second: joi.number().required(),
              offline_fast_hashing_1e10_per_second: joi.number().required(),
            }),
            crack_times_display: joi.object({
              online_throttling_100_per_hour: joi.string().required(),
              online_no_throttling_10_per_second: joi.string().required(),
              offline_slow_hashing_1e4_per_second: joi.string().required(),
              offline_fast_hashing_1e10_per_second: joi.string().required(),
            }),
            score: joi.number().required(),
            feedback: joi.object({
              warning: joi.string().empty('').optional(),
              suggestions: joi.array().items(joi.string()),
            }),
          }).unknown().label('PasswordStrengthMetadata'),
          [INTERNAL_SERVER_ERROR]: ErrorSchema,
        },
      },
    },
    handler: view.checkPasswordStrength,
  });

  server.route({
    method: 'POST',
    path: '/v2.1/user/mobile-devices',
    config: {
      tags: ['api', 'user'],
      description: 'Register user target to receive push notifications',
      validate: {
        headers: joi.object({
          'x-auth-token': joi.string().example('eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...').required(),
        }).unknown(),
        payload: joi.object({
          name: joi.string().min(1).max(64).required(),
          deviceToken: joi.string().required(),
          platform: joi.string().valid(...values(MobileDevicePlatformEnum)).required(),
        }).label('UserDeviceCreateModel'),
      },
    },
    handler: view.createMobileDevice,
  });
}

module.exports = {
  registerRoutes,
};
