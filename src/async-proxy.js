// Proxy-based wrapper to let Promises/Observables pretend like they're regular values.
let { INTERNAL_METHODS } = require('./constants');

// get the mapping function used for async objects
let getMapper = (target) => target instanceof Promise ? 'then' :
    target instanceof Observable ? 'switchMap' : null;
// ^ fails if the Observable is in a local namespace e.g. Rx.Observable

// bind a value to its object if it's a function
let bindFn = (val, obj) => typeof val == 'function' ? val.bind(obj) : val;

// the proxy's trap handler
let asyncHandler = {
  // function invocation
  apply: (targetFn, that, args) => {
    // must wrap Proxy target in functions for this `apply` trap :(
    let target = targetFn();
    let mapper = getMapper(target);
    if(mapper) { // async
      // transparently map; keep Proxy.
      let val = target[mapper]((fn) => fn(args));
      return asyncProxy(val);
    } else { // sync
      // no-op, ditch proxy
      return target.apply(that, args);
    }
  },
  // property access
  get: (targetFn, prop) => {
    let target = targetFn();
    let value;
    let mapper = getMapper(target);
    let bound = bindFn(target[prop], target);
    if(mapper) { // async
      if(prop in target || INTERNAL_METHODS.includes(prop) || typeof prop == 'symbol') {
        // ditch Proxy when directly invoking Promise/Observable method
        // console.log('directly invoked native method, exiting Proxy: ' + prop);
        return bound;
      } else {
        // transparently map; keep Proxy.
        let value = target[mapper]((o) => bindFn(o[prop], o));
        return asyncProxy(value);
      }
    } else {
      // sync: no-op, ditch proxy
      return bound;
    }
  },
};

let asyncProxy = (v) => new Proxy(() => v, asyncHandler);

module.exports = { bindFn, asyncProxy };
