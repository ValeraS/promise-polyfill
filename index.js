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

console.log('Результат работы:');
