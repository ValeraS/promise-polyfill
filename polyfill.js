(function() {
  'use strict';

  var local;
  if (typeof window !== 'undefined') {
    local = window;
  } else if (typeof global !== 'undefined') {
    local = global;
    module.exports = Promise;
  } else {
    throw new Error(
      'Promise polyfill failed because global object is undefined'
    );
  }

  if (
    !(
      typeof local.Promise !== 'undefined' &&
      local.Promise.toString().indexOf('[native code]') !== -1
    )
  ) {
    // return;
    local.Promise = Promise;
  }

  /**
   * Checks
   */

  function checkIsConstructorCall(self) {
    if (!(self instanceof Promise)) {
      throw new Error('Promise should be called with new');
    }
  }

  function checkIsObject(obj, message) {
    if (!isObject(obj)) {
      throw new TypeError(message || 'Not an object: ' + obj);
    }
  }

  function checkIsFunction(fn, message) {
    if (!isFunction(fn)) {
      throw new TypeError(message || 'Not a function');
    }
  }

  function checkIsPromise(x, message) {
    if (!isPromise(x)) {
      throw new TypeError(message || 'Not a Promise');
    }
  }

  function isObject(obj) {
    return obj && (typeof obj === 'object' || isFunction(obj));
  }

  function isFunction(callback) {
    return typeof callback === 'function';
  }

  function isCallable(obj) {
    return isFunction(obj);
  }

  function isPromise(x) {
    if (!isObject(x)) {
      return false;
    }
    return x[PROMISE_STATE_SLOT] !== undefined;
  }

  /**
   * Job queue
   */

  var queue = [];
  function schedule(job) {
    if (queue.length === 0) {
      scheduleExecution();
    }
    queue.push(job);
  }

  function scheduleExecution() {
    setTimeout(flushQueue, 0);
  }

  function flushQueue() {
    var job;
    while (queue.length > 0) {
      job = queue[0];

      job();

      queue.shift();
    }
  }

  /**
   * Promise constants and helpers
   */

  var PENDING = 0;
  var FULFILLED = 1;
  var REJECTED = 2;

  var PROMISE_STATE_SLOT = '_promiseState';
  var PROMISE_REACTIONS_SLOT = '_promiseReactions';
  var PROMISE_RESULT_SLOT = '_promiseResult';

  var IDENTITY = 'Identity';
  var THROWER = 'Thrower';

  function promiseReactionJob(reaction, argument) {
    var capability = reaction.capability;
    var handler = reaction.handler;
    if (handler === IDENTITY) {
      capability.resolve(argument);
    } else if (handler === THROWER) {
      capability.reject(argument);
    } else {
      try {
        var handlerResult = handler(argument);
      } catch (err) {
        capability.reject(err);
      }
      capability.resolve(handlerResult);
    }
  }

  function promiseResolveThenableJob(promiseToResolve, thenable, then) {
    var resolvingFunctions = createResolvingFunctions(promiseToResolve);
    var resolve = resolvingFunctions.resolve;
    var reject = resolvingFunctions.reject;
    try {
      then.call(thenable, resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  function performPromiseThen(
    promise,
    onFulfilled,
    onRejected,
    resultCapabilities
  ) {
    var fulfillmentHandler = isCallable(onFulfilled) ? onFulfilled : IDENTITY;
    var rejectionHandler = isCallable(onRejected) ? onRejected : THROWER;
    if (promise[PROMISE_STATE_SLOT] === PENDING) {
      promise[PROMISE_REACTIONS_SLOT].push(
        resultCapabilities,
        fulfillmentHandler,
        rejectionHandler
      );
    } else if (promise[PROMISE_STATE_SLOT] === FULFILLED) {
      schedule(function() {
        promiseReactionJob(
          {
            capability: resultCapabilities,
            handler: fulfillmentHandler,
          },
          promise[PROMISE_RESULT_SLOT]
        );
      });
    } else if (promise[PROMISE_STATE_SLOT] === REJECTED) {
      schedule(function() {
        promiseReactionJob(
          {
            capability: resultCapabilities,
            handler: rejectionHandler,
          },
          promise[PROMISE_RESULT_SLOT]
        );
      });
    }
    return resultCapabilities.promise;
  }

  function newPromiseCapability(Constructor) {
    var capability = {
      promise: undefined,
      resolve: undefined,
      reject: undefined,
    };
    var promise = new Constructor(function(resolve, reject) {
      if (capability.resolve !== undefined) {
        throw new TypeError('resolve is not undefined');
      }
      if (capability.reject !== undefined) {
        throw new TypeError('reject is not undefined');
      }
      capability.resolve = resolve;
      capability.reject = reject;
    });

    if (capability.resolve === undefined) {
      throw new TypeError('resolve is undefined');
    }
    if (capability.reject === undefined) {
      throw new TypeError('reject is undefined');
    }
    capability.promise = promise;
    return capability;
  }

  function createResolvingFunctions(promise) {
    var isResolved = false;
    var resolve = function(resolution) {
      if (isResolved) {
        return;
      }
      isResolved = true;
      if (promise === resolution) {
        return rejectPromise(
          promise,
          new TypeError('resolved with the same promise')
        );
      }
      if (!isObject(resolution)) {
        return fulfillPromise(promise, resolution);
      }
      try {
        var thenAction = resolution.then;
      } catch (err) {
        return rejectPromise(promise, err);
      }
      if (!isCallable(thenAction)) {
        return fulfillPromise(promise, resolution);
      }
      schedule(function() {
        promiseResolveThenableJob(promise, resolution, thenAction);
      });
    };
    var reject = function(reason) {
      if (isResolved) {
        return;
      }
      isResolved = true;
      return rejectPromise(promise, reason);
    };
    return { resolve: resolve, reject: reject };
  }

  function fulfillPromise(promise, value) {
    var reactions = promise[PROMISE_REACTIONS_SLOT];
    delete promise[PROMISE_REACTIONS_SLOT];
    promise[PROMISE_RESULT_SLOT] = value;
    promise[PROMISE_STATE_SLOT] = FULFILLED;
    for (var i = 0; i < reactions.length; i += 3) {
      schedule(
        (function(i) {
          return function() {
            promiseReactionJob(
              {
                capability: reactions[i],
                handler: reactions[i + FULFILLED],
              },
              value
            );
          };
        })(i)
      );
    }
  }

  function rejectPromise(promise, reason) {
    var reactions = promise[PROMISE_REACTIONS_SLOT];
    delete promise[PROMISE_REACTIONS_SLOT];
    promise[PROMISE_RESULT_SLOT] = reason;
    promise[PROMISE_STATE_SLOT] = REJECTED;
    for (var i = 0; i < reactions.length; i += 3) {
      schedule(
        (function(i) {
          return function() {
            promiseReactionJob(
              {
                capability: reactions[i],
                handler: reactions[i + REJECTED],
              },
              reason
            );
          };
        })(i)
      );
    }
  }

  /**
   * Promise
   */

  function Promise(executor) {
    checkIsConstructorCall(this);
    checkIsFunction(executor);
    this[PROMISE_STATE_SLOT] = PENDING;
    this[PROMISE_REACTIONS_SLOT] = [];
    var resolvingFunctions = createResolvingFunctions(this);
    var resolve = resolvingFunctions.resolve;
    var reject = resolvingFunctions.reject;
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  Promise.prototype.then = function(onFulfilled, onRejected) {
    checkIsPromise(this);
    var resultCapabilities = newPromiseCapability(this.constructor);
    return performPromiseThen(
      this,
      onFulfilled,
      onRejected,
      resultCapabilities
    );
  };

  Promise.prototype.catch = function(onRejected) {
    return this.then(undefined, onRejected);
  };

  Promise.reject = function(r) {
    checkIsObject(this);
    var capability = newPromiseCapability(this);
    capability.reject.call(undefined, r);
    return capability.promise;
  };

  Promise.resolve = function(x) {
    checkIsObject(this);
    if (isPromise(x)) {
      if (x.constructor === this) {
        return x;
      }
    }
    var capability = newPromiseCapability(this);
    capability.resolve.call(undefined, x);
    return capability.promise;
  };

  Promise.race = function(promises) {
    var Constructor = this;
    checkIsObject(Constructor);
    if (!Array.isArray(promises)) {
      return Constructor.reject(new TypeError(promises + ' is not iterable'));
    }
    return new Constructor(function(resolve, reject) {
      for (var i = 0; i < promises.length; i++) {
        Constructor.resolve(promises[i]).then(resolve, reject);
      }
    });
  };

  Promise.all = function(promises) {
    var Constructor = this;
    checkIsObject(Constructor);
    if (!Array.isArray(promises)) {
      return Constructor.reject(new TypeError(promises + ' is not iterable'));
    }
    if (!promises.length) {
      return Constructor.resolve(promises);
    }
    return new Constructor(function(resolve, reject) {
      var promiseCount = promises.length;
      var values = [];
      for (var i = 0; i < promises.length; i++) {
        Constructor.resolve(promises[i]).then(
          (function(i) {
            return function(value) {
              values[i] = value;
              promiseCount--;
              if (!promiseCount) {
                resolve(values);
              }
            };
          })(i),
          reject
        );
      }
    });
  };

  Promise.allSettled = function(promises) {
    var Constructor = this;
    checkIsObject(Constructor);
    if (!Array.isArray(promises)) {
      return Constructor.reject(new TypeError(promises + ' is not iterable'));
    }
    if (!promises.length) {
      return Constructor.resolve(promises);
    }
    return new Constructor(function(resolve) {
      var promiseCount = promises.length;
      var values = [];
      for (var i = 0; i < promises.length; i++) {
        Constructor.resolve(promises[i]).then(
          (function(i) {
            return function(value) {
              values[i] = {
                status: 'fulfilled',
                value: value,
              };
              promiseCount--;
              if (!promiseCount) {
                resolve(values);
              }
            };
          })(i),
          (function(i) {
            return function(reason) {
              values[i] = {
                status: 'rejected',
                reason: reason,
              };
              promiseCount--;
              if (!promiseCount) {
                resolve(values);
              }
            };
          })(i)
        );
      }
    });
  };

  Promise.prototype.finally = function(onFinally) {
    var promise = this;
    checkIsObject(this);
    var Constructor = this.constructor;
    var thenFinally, catchFinally;
    if (!isFunction(onFinally)) {
      thenFinally = catchFinally = onFinally;
    } else {
      thenFinally = function(value) {
        return Constructor.resolve(onFinally()).then(function() {
          return value;
        });
      };
      catchFinally = function(reason) {
        return Constructor.resolve(onFinally()).then(function() {
          throw reason;
        });
      };
    }
    return promise.then(thenFinally, catchFinally);
  };
})();
