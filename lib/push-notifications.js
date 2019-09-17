'use strict';

var _sendGCM = require('./sendGCM');

var _sendGCM2 = _interopRequireDefault(_sendGCM);

var _sendAPN = require('./sendAPN');

var _sendAPN2 = _interopRequireDefault(_sendAPN);

var _sendADM = require('./sendADM');

var _sendADM2 = _interopRequireDefault(_sendADM);

var _sendWNS = require('./sendWNS');

var _sendWNS2 = _interopRequireDefault(_sendWNS);

var _sendWeb = require('./sendWeb');

var _sendWeb2 = _interopRequireDefault(_sendWeb);

var _constants = require('./constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class PN {
  constructor(options) {
    this.setOptions(options);
  }

  setOptions(opts) {
    this.settings = Object.assign({}, _constants.DEFAULT_SETTINGS, opts);
    if (this.apn) {
      this.apn.shutdown();
    }
    this.apn = new _sendAPN2.default(this.settings.apn);
  }

  sendWith(method, regIds, data, cb) {
    return method(regIds, data, this.settings).then(results => {
      (cb || (noop => noop))(null, results);
      return results;
    }).catch(error => {
      (cb || (noop => noop))(error);
      return Promise.reject(error);
    });
  }

  send(_regIds, data, callback) {
    const promises = [];
    const regIdsGCM = [];
    const regIdsAPN = [];
    const regIdsWNS = [];
    const regIdsADM = [];
    const regIdsWebPush = [];
    const regIdsUnk = [];
    const regIds = Array.isArray(_regIds || []) ? _regIds || [] : [_regIds];

    // Classify each pushId for corresponding device
    regIds.forEach(regId => {
      if (typeof regId === 'object') {
        regIdsWebPush.push(regId);
      } else if (this.settings.isAlwaysUseFCM) {
        regIdsGCM.push(regId);
      } else if (regId.substring(0, 4) === 'http') {
        regIdsWNS.push(regId);
      } else if (/^(amzn[0-9]*.adm)/i.test(regId)) {
        regIdsADM.push(regId);
      } else if (regId.length > 64) {
        regIdsGCM.push(regId);
      } else if (regId.length === 64) {
        regIdsAPN.push(regId);
      } else {
        regIdsUnk.push(regId);
      }
    });

    try {
      // Android GCM
      if (regIdsGCM.length > 0) {
        promises.push(this.sendWith(_sendGCM2.default, regIdsGCM, data));
      }

      // iOS APN
      if (regIdsAPN.length > 0) {
        promises.push(this.sendWith(this.apn.sendAPN.bind(this.apn), regIdsAPN, data));
      }

      // Microsoft WNS
      if (regIdsWNS.length > 0) {
        promises.push(this.sendWith(_sendWNS2.default, regIdsWNS, data));
      }

      // Amazon ADM
      if (regIdsADM.length > 0) {
        promises.push(this.sendWith(_sendADM2.default, regIdsADM, data));
      }

      // Web Push
      if (regIdsWebPush.length > 0) {
        promises.push(this.sendWith(_sendWeb2.default, regIdsWebPush, data));
      }
    } catch (err) {
      promises.push(Promise.reject(err));
    }

    // Unknown
    if (regIdsUnk.length > 0) {
      const results = {
        method: 'unknown',
        success: 0,
        failure: regIdsUnk.length,
        message: []
      };
      regIdsUnk.forEach(regId => {
        results.message.push({
          regId,
          error: new Error('Unknown registration id')
        });
      });
      promises.push(Promise.resolve(results));
    }

    // No regIds detected
    if (promises.length === 0) {
      promises.push(Promise.resolve({
        method: 'none',
        success: 0,
        failure: 0,
        message: []
      }));
    }

    return Promise.all(promises).then(results => {
      const cb = callback || (noop => noop);
      cb(null, results);
      return results;
    }).catch(err => {
      const cb = callback || (noop => noop);
      cb(err);
      return Promise.reject(err);
    });
  }
}

module.exports = PN;