var Promise = require('./polyfill');

var promise = new Promise(function(resolve) {
  resolve(41);
});

promise
  .then(function(value) {
    return value + 1;
  })
  .then(function(value) {
    console.log(value); // 42
    return new Promise(function(resolve) {
      resolve(137);
    });
  })
  .then(function(value) {
    console.log(value); // 137
    throw new Error();
  })
  .then(
    function() {
      console.log('Будет проигнорировано');
    },
    function() {
      return 'ошибка обработана';
    }
  )
  .then(function(value) {
    console.log(value); // "ошибка обработана"
  });

Promise.resolve(42).then(
  function(value) {
    console.log('Значение: ' + value); // Значение: 42
  },
  function() {
    console.log('Будет проигнорировано.');
  }
);

Promise.reject(new Error('Ошибка')).then(
  function() {
    console.log('Будет проигнорировано');
  },
  function(err) {
    console.log(err.message); // Ошибка
  }
);

Promise.all([
  Promise.resolve(42),
  new Promise(function(resolve) {
    setTimeout(function() {
      resolve(21);
    }, 100);
  }),
]).then(
  function(value) {
    console.log(value); // [ 42, 21 ]
  },
  function() {
    console.log('Будет проигнорировано');
  }
);

Promise.race([
  new Promise(function(resolve) {
    setTimeout(function() {
      resolve(21);
    }, 100);
  }),
  Promise.resolve(42),
]).then(
  function(value) {
    console.log('Race:' + value); // Race: 42
  },
  function() {
    console.log('Будет проигнорировано');
  }
);

Promise.race([
  new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject(21);
    }, 100);
  }),
  new Promise(function(resolve) {
    setTimeout(function() {
      resolve(15);
    }, 10);
  }),
]).then(
  function(value) {
    console.log('Race:' + value); // Race: 15
  },
  function() {
    console.log('Будет проигнорировано');
  }
);

Promise.resolve(42)
  .finally(function() {
    console.log('In finally after resolve');
  })
  .then(
    function(value) {
      console.log('Resolve after finally:' + value); // Resolve after finally: 42
    },
    function() {
      console.log('Будет проигнорировано');
    }
  );

Promise.reject(new Error('Ошибка'))
  .finally(function() {
    console.log('In finally after reject');
  })
  .then(
    function() {
      console.log('Будет проигнорировано');
    },
    function(err) {
      console.log('Reject after finally:' + err.message); // Reject after finally: Ошибка
    }
  );

Promise.allSettled([
  new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject(21);
    }, 100);
  }),
  new Promise(function(resolve) {
    setTimeout(function() {
      resolve(15);
    }, 10);
  }),
]).then(
  function(value) {
    console.log(value); // [ { status: 'rejected', reason: 21 },{ status: 'fulfilled', value: 15 } ]
  },
  function() {
    console.log('Будет проигнорировано');
  }
);

console.log('Результат работы:');
