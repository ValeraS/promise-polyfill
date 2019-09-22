var promiseTests = require('promises-aplus-tests');
var MyPromise = require('./polyfill');

var adapter = {
  resolved: function(value) {
    return MyPromise.resolve(value);
  },

  rejected: function(reason) {
    return MyPromise.reject(reason);
  },

  deferred: function() {
    var capabilities = {};
    capabilities.promise = new MyPromise(function(resolve, reject) {
      capabilities.resolve = resolve;
      capabilities.reject = reject;
    });

    return capabilities;
  },
};

promiseTests(adapter);
