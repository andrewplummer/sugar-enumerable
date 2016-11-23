/*
 *  Sugar v2.0.4
 *
 *  Freely distributable and licensed under the MIT-style license.
 *  Copyright (c) Andrew Plummer
 *  https://sugarjs.com/
 *
 * ---------------------------- */
(function() {
  'use strict';

  /***
   * @module Core
   * @description Core functionality including the ability to define methods and
   *              extend onto natives.
   *
   ***/

  // The global to export.
  var Sugar;

  // The name of Sugar in the global namespace.
  var SUGAR_GLOBAL = 'Sugar';

  // Natives available on initialization. Letting Object go first to ensure its
  // global is set by the time the rest are checking for chainable Object methods.
  var NATIVE_NAMES = 'Object Number String Array Date RegExp Function';

  // Static method flag
  var STATIC   = 0x1;

  // Instance method flag
  var INSTANCE = 0x2;

  // IE8 has a broken defineProperty but no defineProperties so this saves a try/catch.
  var PROPERTY_DESCRIPTOR_SUPPORT = !!(Object.defineProperty && Object.defineProperties);

  // The global context. Rhino uses a different "global" keyword so
  // do an extra check to be sure that it's actually the global context.
  var globalContext = typeof global !== 'undefined' && global.Object === Object ? global : this;

  // Is the environment node?
  var hasExports = typeof module !== 'undefined' && module.exports;

  // Whether object instance methods can be mapped to the prototype.
  var allowObjectPrototype = false;

  // A map from Array to SugarArray.
  var namespacesByName = {};

  // A map from [object Object] to namespace.
  var namespacesByClassString = {};

  // Defining properties.
  var defineProperty = PROPERTY_DESCRIPTOR_SUPPORT ?  Object.defineProperty : definePropertyShim;

  // A default chainable class for unknown types.
  var DefaultChainable = getNewChainableClass('Chainable');


  // Global methods

  function setupGlobal() {
    Sugar = globalContext[SUGAR_GLOBAL];
    if (Sugar) {
      // Reuse already defined Sugar global object.
      return;
    }
    Sugar = function(arg) {
      forEachProperty(Sugar, function(sugarNamespace, name) {
        // Although only the only enumerable properties on the global
        // object are Sugar namespaces, environments that can't set
        // non-enumerable properties will step through the utility methods
        // as well here, so use this check to only allow true namespaces.
        if (hasOwn(namespacesByName, name)) {
          sugarNamespace.extend(arg);
        }
      });
      return Sugar;
    };
    if (hasExports) {
      module.exports = Sugar;
    } else {
      try {
        globalContext[SUGAR_GLOBAL] = Sugar;
      } catch (e) {
        // Contexts such as QML have a read-only global context.
      }
    }
    forEachProperty(NATIVE_NAMES.split(' '), function(name) {
      createNamespace(name);
    });
    setGlobalProperties();
  }

  /***
   * @method createNamespace(name)
   * @returns SugarNamespace
   * @namespace Sugar
   * @short Creates a new Sugar namespace.
   * @extra This method is for plugin developers who want to define methods to be
   *        used with natives that Sugar does not handle by default. The new
   *        namespace will appear on the `Sugar` global with all the methods of
   *        normal namespaces, including the ability to define new methods. When
   *        extended, any defined methods will be mapped to `name` in the global
   *        context.
   *
   * @example
   *
   *   Sugar.createNamespace('Boolean');
   *
   * @param {string} name - The namespace name.
   *
   ***/
  function createNamespace(name) {

    // Is the current namespace Object?
    var isObject = name === 'Object';

    // A Sugar namespace is also a chainable class: Sugar.Array, etc.
    var sugarNamespace = getNewChainableClass(name, true);

    /***
     * @method extend([opts])
     * @returns Sugar
     * @namespace Sugar
     * @short Extends Sugar defined methods onto natives.
     * @extra This method can be called on individual namespaces like
     *        `Sugar.Array` or on the `Sugar` global itself, in which case
     *        [opts] will be forwarded to each `extend` call. For more,
     *        see `extending`.
     *
     * @options
     *
     *   methods           An array of method names to explicitly extend.
     *
     *   except            An array of method names or global namespaces (`Array`,
     *                     `String`) to explicitly exclude. Namespaces should be the
     *                     actual global objects, not strings.
     *
     *   namespaces        An array of global namespaces (`Array`, `String`) to
     *                     explicitly extend. Namespaces should be the actual
     *                     global objects, not strings.
     *
     *   enhance           A shortcut to disallow all "enhance" flags at once
     *                     (flags listed below). For more, see `enhanced methods`.
     *                     Default is `true`.
     *
     *   enhanceString     A boolean allowing String enhancements. Default is `true`.
     *
     *   enhanceArray      A boolean allowing Array enhancements. Default is `true`.
     *
     *   objectPrototype   A boolean allowing Sugar to extend Object.prototype
     *                     with instance methods. This option is off by default
     *                     and should generally not be used except with caution.
     *                     For more, see `object methods`.
     *
     * @example
     *
     *   Sugar.Array.extend();
     *   Sugar.extend();
     *
     * @option {Array<string>} [methods]
     * @option {Array<string|NativeConstructor>} [except]
     * @option {Array<NativeConstructor>} [namespaces]
     * @option {boolean} [enhance]
     * @option {boolean} [enhanceString]
     * @option {boolean} [enhanceArray]
     * @option {boolean} [objectPrototype]
     * @param {ExtendOptions} [opts]
     *
     ***
     * @method extend([opts])
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Extends Sugar defined methods for a specific namespace onto natives.
     * @param {ExtendOptions} [opts]
     *
     ***/
    var extend = function (opts) {

      var nativeClass = globalContext[name], nativeProto = nativeClass.prototype;
      var staticMethods = {}, instanceMethods = {}, methodsByName;

      function objectRestricted(name, target) {
        return isObject && target === nativeProto &&
               (!allowObjectPrototype || name === 'get' || name === 'set');
      }

      function arrayOptionExists(field, val) {
        var arr = opts[field];
        if (arr) {
          for (var i = 0, el; el = arr[i]; i++) {
            if (el === val) {
              return true;
            }
          }
        }
        return false;
      }

      function arrayOptionExcludes(field, val) {
        return opts[field] && !arrayOptionExists(field, val);
      }

      function disallowedByFlags(methodName, target, flags) {
        // Disallowing methods by flag currently only applies if methods already
        // exist to avoid enhancing native methods, as aliases should still be
        // extended (i.e. Array#all should still be extended even if Array#every
        // is being disallowed by a flag).
        if (!target[methodName] || !flags) {
          return false;
        }
        for (var i = 0; i < flags.length; i++) {
          if (opts[flags[i]] === false) {
            return true;
          }
        }
      }

      function namespaceIsExcepted() {
        return arrayOptionExists('except', nativeClass) ||
               arrayOptionExcludes('namespaces', nativeClass);
      }

      function methodIsExcepted(methodName) {
        return arrayOptionExists('except', methodName);
      }

      function canExtend(methodName, method, target) {
        return !objectRestricted(methodName, target) &&
               !disallowedByFlags(methodName, target, method.flags) &&
               !methodIsExcepted(methodName);
      }

      opts = opts || {};
      methodsByName = opts.methods;

      if (namespaceIsExcepted()) {
        return;
      } else if (isObject && typeof opts.objectPrototype === 'boolean') {
        // Store "objectPrototype" flag for future reference.
        allowObjectPrototype = opts.objectPrototype;
      }

      forEachProperty(methodsByName || sugarNamespace, function(method, methodName) {
        if (methodsByName) {
          // If we have method names passed in an array,
          // then we need to flip the key and value here
          // and find the method in the Sugar namespace.
          methodName = method;
          method = sugarNamespace[methodName];
        }
        if (hasOwn(method, 'instance') && canExtend(methodName, method, nativeProto)) {
          instanceMethods[methodName] = method.instance;
        }
        if(hasOwn(method, 'static') && canExtend(methodName, method, nativeClass)) {
          staticMethods[methodName] = method;
        }
      });

      // Accessing the extend target each time instead of holding a reference as
      // it may have been overwritten (for example Date by Sinon). Also need to
      // access through the global to allow extension of user-defined namespaces.
      extendNative(nativeClass, staticMethods);
      extendNative(nativeProto, instanceMethods);

      if (!methodsByName) {
        // If there are no method names passed, then
        // all methods in the namespace will be extended
        // to the native. This includes all future defined
        // methods, so add a flag here to check later.
        setProperty(sugarNamespace, 'active', true);
      }
      return sugarNamespace;
    };

    function defineWithOptionCollect(methodName, instance, args) {
      setProperty(sugarNamespace, methodName, function(arg1, arg2, arg3) {
        var opts = collectDefineOptions(arg1, arg2, arg3);
        defineMethods(sugarNamespace, opts.methods, instance, args, opts.last);
        return sugarNamespace;
      });
    }

    /***
     * @method defineStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods on the namespace that can later be extended
     *        onto the native globals.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. If `extend` was previously called
     *        with no arguments, the method will be immediately mapped to its
     *        native when defined.
     *
     * @example
     *
     *   Sugar.Number.defineStatic({
     *     isOdd: function (num) {
     *       return num % 2 === 1;
     *     }
     *   });
     *
     * @signature defineStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStatic', STATIC);

    /***
     * @method defineInstance(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines methods on the namespace that can later be extended as
     *        instance methods onto the native prototype.
     * @extra Accepts either a single object mapping names to functions, or name
     *        and function as two arguments. All functions should accept the
     *        native for which they are mapped as their first argument, and should
     *        never refer to `this`. If `extend` was previously called with no
     *        arguments, the method will be immediately mapped to its native when
     *        defined.
     *
     *        Methods cannot accept more than 4 arguments in addition to the
     *        native (5 arguments total). Any additional arguments will not be
     *        mapped. If the method needs to accept unlimited arguments, use
     *        `defineInstanceWithArguments`. Otherwise if more options are
     *        required, use an options object instead.
     *
     * @example
     *
     *   Sugar.Number.defineInstance({
     *     square: function (num) {
     *       return num * num;
     *     }
     *   });
     *
     * @signature defineInstance(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstance', INSTANCE);

    /***
     * @method defineInstanceAndStatic(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short A shortcut to define both static and instance methods on the namespace.
     * @extra This method is intended for use with `Object` instance methods. Sugar
     *        will not map any methods to `Object.prototype` by default, so defining
     *        instance methods as static helps facilitate their proper use.
     *
     * @example
     *
     *   Sugar.Object.defineInstanceAndStatic({
     *     isAwesome: function (obj) {
     *       // check if obj is awesome!
     *     }
     *   });
     *
     * @signature defineInstanceAndStatic(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceAndStatic', INSTANCE | STATIC);


    /***
     * @method defineStaticWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that collect arguments.
     * @extra This method is identical to `defineStatic`, except that when defined
     *        methods are called, they will collect any arguments past `n - 1`,
     *        where `n` is the number of arguments that the method accepts.
     *        Collected arguments will be passed to the method in an array
     *        as the last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineStaticWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineStaticWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineStaticWithArguments', STATIC, true);

    /***
     * @method defineInstanceWithArguments(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that collect arguments.
     * @extra This method is identical to `defineInstance`, except that when
     *        defined methods are called, they will collect any arguments past
     *        `n - 1`, where `n` is the number of arguments that the method
     *        accepts. Collected arguments will be passed to the method as the
     *        last argument defined on the function.
     *
     * @example
     *
     *   Sugar.Number.defineInstanceWithArguments({
     *     addAll: function (num, args) {
     *       for (var i = 0; i < args.length; i++) {
     *         num += args[i];
     *       }
     *       return num;
     *     }
     *   });
     *
     * @signature defineInstanceWithArguments(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    defineWithOptionCollect('defineInstanceWithArguments', INSTANCE, true);

    /***
     * @method defineStaticPolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines static methods that are mapped onto the native if they do
     *        not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments.
     *
     * @example
     *
     *   Sugar.Object.defineStaticPolyfill({
     *     keys: function (obj) {
     *       // get keys!
     *     }
     *   });
     *
     * @signature defineStaticPolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineStaticPolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name], opts.methods, true, opts.last);
      return sugarNamespace;
    });

    /***
     * @method defineInstancePolyfill(methods)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Defines instance methods that are mapped onto the native prototype
     *        if they do not already exist.
     * @extra Intended only for use creating polyfills that follow the ECMAScript
     *        spec. Accepts either a single object mapping names to functions, or
     *        name and function as two arguments. This method differs from
     *        `defineInstance` as there is no static signature (as the method
     *        is mapped as-is to the native), so it should refer to its `this`
     *        object.
     *
     * @example
     *
     *   Sugar.Array.defineInstancePolyfill({
     *     indexOf: function (arr, el) {
     *       // index finding code here!
     *     }
     *   });
     *
     * @signature defineInstancePolyfill(methodName, methodFn)
     * @param {Object} methods - Methods to be defined.
     * @param {string} methodName - Name of a single method to be defined.
     * @param {Function} methodFn - Function body of a single method to be defined.
     ***/
    setProperty(sugarNamespace, 'defineInstancePolyfill', function(arg1, arg2, arg3) {
      var opts = collectDefineOptions(arg1, arg2, arg3);
      extendNative(globalContext[name].prototype, opts.methods, true, opts.last);
      // Map instance polyfills to chainable as well.
      forEachProperty(opts.methods, function(fn, methodName) {
        defineChainableMethod(sugarNamespace, methodName, fn);
      });
      return sugarNamespace;
    });

    /***
     * @method alias(toName, from)
     * @returns SugarNamespace
     * @namespace SugarNamespace
     * @short Aliases one Sugar method to another.
     *
     * @example
     *
     *   Sugar.Array.alias('all', 'every');
     *
     * @signature alias(toName, fn)
     * @param {string} toName - Name for new method.
     * @param {string|Function} from - Method to alias, or string shortcut.
     ***/
    setProperty(sugarNamespace, 'alias', function(name, source) {
      var method = typeof source === 'string' ? sugarNamespace[source] : source;
      setMethod(sugarNamespace, name, method);
      return sugarNamespace;
    });

    // Each namespace can extend only itself through its .extend method.
    setProperty(sugarNamespace, 'extend', extend);

    // Cache the class to namespace relationship for later use.
    namespacesByName[name] = sugarNamespace;
    namespacesByClassString['[object ' + name + ']'] = sugarNamespace;

    mapNativeToChainable(name);
    mapObjectChainablesToNamespace(sugarNamespace);


    // Export
    return Sugar[name] = sugarNamespace;
  }

  function setGlobalProperties() {
    setProperty(Sugar, 'extend', Sugar);
    setProperty(Sugar, 'toString', toString);
    setProperty(Sugar, 'createNamespace', createNamespace);

    setProperty(Sugar, 'util', {
      'hasOwn': hasOwn,
      'getOwn': getOwn,
      'setProperty': setProperty,
      'classToString': classToString,
      'defineProperty': defineProperty,
      'forEachProperty': forEachProperty,
      'mapNativeToChainable': mapNativeToChainable
    });
  }

  function toString() {
    return SUGAR_GLOBAL;
  }


  // Defining Methods

  function defineMethods(sugarNamespace, methods, type, args, flags) {
    forEachProperty(methods, function(method, methodName) {
      var instanceMethod, staticMethod = method;
      if (args) {
        staticMethod = wrapMethodWithArguments(method);
      }
      if (flags) {
        staticMethod.flags = flags;
      }

      // A method may define its own custom implementation, so
      // make sure that's not the case before creating one.
      if (type & INSTANCE && !method.instance) {
        instanceMethod = wrapInstanceMethod(method, args);
        setProperty(staticMethod, 'instance', instanceMethod);
      }

      if (type & STATIC) {
        setProperty(staticMethod, 'static', true);
      }

      setMethod(sugarNamespace, methodName, staticMethod);

      if (sugarNamespace.active) {
        // If the namespace has been activated (.extend has been called),
        // then map this method as well.
        sugarNamespace.extend(methodName);
      }
    });
  }

  function collectDefineOptions(arg1, arg2, arg3) {
    var methods, last;
    if (typeof arg1 === 'string') {
      methods = {};
      methods[arg1] = arg2;
      last = arg3;
    } else {
      methods = arg1;
      last = arg2;
    }
    return {
      last: last,
      methods: methods
    };
  }

  function wrapInstanceMethod(fn, args) {
    return args ? wrapMethodWithArguments(fn, true) : wrapInstanceMethodFixed(fn);
  }

  function wrapMethodWithArguments(fn, instance) {
    // Functions accepting enumerated arguments will always have "args" as the
    // last argument, so subtract one from the function length to get the point
    // at which to start collecting arguments. If this is an instance method on
    // a prototype, then "this" will be pushed into the arguments array so start
    // collecting 1 argument earlier.
    var startCollect = fn.length - 1 - (instance ? 1 : 0);
    return function() {
      var args = [], collectedArgs = [], len;
      if (instance) {
        args.push(this);
      }
      len = Math.max(arguments.length, startCollect);
      // Optimized: no leaking arguments
      for (var i = 0; i < len; i++) {
        if (i < startCollect) {
          args.push(arguments[i]);
        } else {
          collectedArgs.push(arguments[i]);
        }
      }
      args.push(collectedArgs);
      return fn.apply(this, args);
    };
  }

  function wrapInstanceMethodFixed(fn) {
    switch(fn.length) {
      // Wrapped instance methods will always be passed the instance
      // as the first argument, but requiring the argument to be defined
      // may cause confusion here, so return the same wrapped function regardless.
      case 0:
      case 1:
        return function() {
          return fn(this);
        };
      case 2:
        return function(a) {
          return fn(this, a);
        };
      case 3:
        return function(a, b) {
          return fn(this, a, b);
        };
      case 4:
        return function(a, b, c) {
          return fn(this, a, b, c);
        };
      case 5:
        return function(a, b, c, d) {
          return fn(this, a, b, c, d);
        };
    }
  }

  // Method helpers

  function extendNative(target, source, polyfill, override) {
    forEachProperty(source, function(method, name) {
      if (polyfill && !override && target[name]) {
        // Method exists, so bail.
        return;
      }
      setProperty(target, name, method);
    });
  }

  function setMethod(sugarNamespace, methodName, method) {
    sugarNamespace[methodName] = method;
    if (method.instance) {
      defineChainableMethod(sugarNamespace, methodName, method.instance, true);
    }
  }


  // Chainables

  function getNewChainableClass(name) {
    var fn = function SugarChainable(obj, arg) {
      if (!(this instanceof fn)) {
        return new fn(obj, arg);
      }
      if (this.constructor !== fn) {
        // Allow modules to define their own constructors.
        obj = this.constructor.apply(obj, arguments);
      }
      this.raw = obj;
    };
    setProperty(fn, 'toString', function() {
      return SUGAR_GLOBAL + name;
    });
    setProperty(fn.prototype, 'valueOf', function() {
      return this.raw;
    });
    return fn;
  }

  function defineChainableMethod(sugarNamespace, methodName, fn) {
    var wrapped = wrapWithChainableResult(fn), existing, collision, dcp;
    dcp = DefaultChainable.prototype;
    existing = dcp[methodName];

    // If the method was previously defined on the default chainable, then a
    // collision exists, so set the method to a disambiguation function that will
    // lazily evaluate the object and find it's associated chainable. An extra
    // check is required to avoid false positives from Object inherited methods.
    collision = existing && existing !== Object.prototype[methodName];

    // The disambiguation function is only required once.
    if (!existing || !existing.disambiguate) {
      dcp[methodName] = collision ? disambiguateMethod(methodName) : wrapped;
    }

    // The target chainable always receives the wrapped method. Additionally,
    // if the target chainable is Sugar.Object, then map the wrapped method
    // to all other namespaces as well if they do not define their own method
    // of the same name. This way, a Sugar.Number will have methods like
    // isEqual that can be called on any object without having to traverse up
    // the prototype chain and perform disambiguation, which costs cycles.
    // Note that the "if" block below actually does nothing on init as Object
    // goes first and no other namespaces exist yet. However it needs to be
    // here as Object instance methods defined later also need to be mapped
    // back onto existing namespaces.
    sugarNamespace.prototype[methodName] = wrapped;
    if (sugarNamespace === Sugar.Object) {
      mapObjectChainableToAllNamespaces(methodName, wrapped);
    }
  }

  function mapObjectChainablesToNamespace(sugarNamespace) {
    forEachProperty(Sugar.Object && Sugar.Object.prototype, function(val, methodName) {
      if (typeof val === 'function') {
        setObjectChainableOnNamespace(sugarNamespace, methodName, val);
      }
    });
  }

  function mapObjectChainableToAllNamespaces(methodName, fn) {
    forEachProperty(namespacesByName, function(sugarNamespace) {
      setObjectChainableOnNamespace(sugarNamespace, methodName, fn);
    });
  }

  function setObjectChainableOnNamespace(sugarNamespace, methodName, fn) {
    var proto = sugarNamespace.prototype;
    if (!hasOwn(proto, methodName)) {
      proto[methodName] = fn;
    }
  }

  function wrapWithChainableResult(fn) {
    return function() {
      return new DefaultChainable(fn.apply(this.raw, arguments));
    };
  }

  function disambiguateMethod(methodName) {
    var fn = function() {
      var raw = this.raw, sugarNamespace, fn;
      if (raw != null) {
        // Find the Sugar namespace for this unknown.
        sugarNamespace = namespacesByClassString[classToString(raw)];
      }
      if (!sugarNamespace) {
        // If no sugarNamespace can be resolved, then default
        // back to Sugar.Object so that undefined and other
        // non-supported types can still have basic object
        // methods called on them, such as type checks.
        sugarNamespace = Sugar.Object;
      }

      fn = new sugarNamespace(raw)[methodName];

      if (fn.disambiguate) {
        // If the method about to be called on this chainable is
        // itself a disambiguation method, then throw an error to
        // prevent infinite recursion.
        throw new TypeError('Cannot resolve namespace for ' + raw);
      }

      return fn.apply(this, arguments);
    };
    fn.disambiguate = true;
    return fn;
  }

  function mapNativeToChainable(name, methodNames) {
    var sugarNamespace = namespacesByName[name],
        nativeProto = globalContext[name].prototype;

    if (!methodNames && ownPropertyNames) {
      methodNames = ownPropertyNames(nativeProto);
    }

    forEachProperty(methodNames, function(methodName) {
      if (nativeMethodProhibited(methodName)) {
        // Sugar chainables have their own constructors as well as "valueOf"
        // methods, so exclude them here. The __proto__ argument should be trapped
        // by the function check below, however simply accessing this property on
        // Object.prototype causes QML to segfault, so pre-emptively excluding it.
        return;
      }
      try {
        var fn = nativeProto[methodName];
        if (typeof fn !== 'function') {
          // Bail on anything not a function.
          return;
        }
      } catch (e) {
        // Function.prototype has properties that
        // will throw errors when accessed.
        return;
      }
      defineChainableMethod(sugarNamespace, methodName, fn);
    });
  }

  function nativeMethodProhibited(methodName) {
    return methodName === 'constructor' ||
           methodName === 'valueOf' ||
           methodName === '__proto__';
  }


  // Util

  // Internal references
  var ownPropertyNames = Object.getOwnPropertyNames,
      internalToString = Object.prototype.toString,
      internalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Defining this as a variable here as the ES5 module
  // overwrites it to patch DONTENUM.
  var forEachProperty = function (obj, fn) {
    for(var key in obj) {
      if (!hasOwn(obj, key)) continue;
      if (fn.call(obj, obj[key], key, obj) === false) break;
    }
  };

  function definePropertyShim(obj, prop, descriptor) {
    obj[prop] = descriptor.value;
  }

  function setProperty(target, name, value, enumerable) {
    defineProperty(target, name, {
      value: value,
      enumerable: !!enumerable,
      configurable: true,
      writable: true
    });
  }

  // PERF: Attempts to speed this method up get very Heisenbergy. Quickly
  // returning based on typeof works for primitives, but slows down object
  // types. Even === checks on null and undefined (no typeof) will end up
  // basically breaking even. This seems to be as fast as it can go.
  function classToString(obj) {
    return internalToString.call(obj);
  }

  function hasOwn(obj, prop) {
    return !!obj && internalHasOwnProperty.call(obj, prop);
  }

  function getOwn(obj, prop) {
    if (hasOwn(obj, prop)) {
      return obj[prop];
    }
  }

  setupGlobal();

  /***
   * @module Common
   * @description Internal utility and common methods.
   ***/

  // Flag allowing native methods to be enhanced
  var ENHANCEMENTS_FLAG = 'enhance';

  // For type checking, etc. Excludes object as this is more nuanced.
  var NATIVE_TYPES = 'Boolean Number String Date RegExp Function Array Error Set Map';

  // Do strings have no keys?
  var NO_KEYS_IN_STRING_OBJECTS = !('0' in Object('a'));

  // Prefix for private properties
  var PRIVATE_PROP_PREFIX = '_sugar_';

  // Matches 1..2 style ranges in properties
  var PROPERTY_RANGE_REG = /^(.*?)\[([-\d]*)\.\.([-\d]*)\](.*)$/;

  // WhiteSpace/LineTerminator as defined in ES5.1 plus Unicode characters in the Space, Separator category.
  var TRIM_CHARS = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';

  // Regex for matching a formatted string
  var STRING_FORMAT_REG = /([{}])\1|\{([^}]*)\}|(%)%|(%(\w*))/g;

  // Common chars
  var HALF_WIDTH_ZERO = 0x30,
      FULL_WIDTH_ZERO = 0xff10,
      HALF_WIDTH_PERIOD   = '.',
      FULL_WIDTH_PERIOD   = '．',
      HALF_WIDTH_COMMA    = ',',
      OPEN_BRACE  = '{',
      CLOSE_BRACE = '}';

  // Namespace aliases
  var sugarObject   = Sugar.Object,
      sugarArray    = Sugar.Array,
      sugarDate     = Sugar.Date,
      sugarString   = Sugar.String,
      sugarNumber   = Sugar.Number,
      sugarFunction = Sugar.Function,
      sugarRegExp   = Sugar.RegExp;

  // Class checks
  var isSerializable,
      isBoolean, isNumber, isString,
      isDate, isRegExp, isFunction,
      isArray, isSet, isMap, isError;

  function buildClassChecks() {

    var knownTypes = {};

    function addCoreTypes() {

      var names = spaceSplit(NATIVE_TYPES);

      isBoolean = buildPrimitiveClassCheck(names[0]);
      isNumber  = buildPrimitiveClassCheck(names[1]);
      isString  = buildPrimitiveClassCheck(names[2]);

      isDate   = buildClassCheck(names[3]);
      isRegExp = buildClassCheck(names[4]);

      // Wanted to enhance performance here by using simply "typeof"
      // but Firefox has two major issues that make this impossible,
      // one fixed, the other not, so perform a full class check here.
      //
      // 1. Regexes can be typeof "function" in FF < 3
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=61911 (fixed)
      //
      // 2. HTMLEmbedElement and HTMLObjectElement are be typeof "function"
      //    https://bugzilla.mozilla.org/show_bug.cgi?id=268945 (won't fix)
      isFunction = buildClassCheck(names[5]);


      isArray = Array.isArray || buildClassCheck(names[6]);
      isError = buildClassCheck(names[7]);

      isSet = buildClassCheck(names[8], typeof Set !== 'undefined' && Set);
      isMap = buildClassCheck(names[9], typeof Map !== 'undefined' && Map);

      // Add core types as known so that they can be checked by value below,
      // notably excluding Functions and adding Arguments and Error.
      addKnownType('Arguments');
      addKnownType(names[0]);
      addKnownType(names[1]);
      addKnownType(names[2]);
      addKnownType(names[3]);
      addKnownType(names[4]);
      addKnownType(names[6]);

    }

    function addArrayTypes() {
      var types = 'Int8 Uint8 Uint8Clamped Int16 Uint16 Int32 Uint32 Float32 Float64';
      forEach(spaceSplit(types), function(str) {
        addKnownType(str + 'Array');
      });
    }

    function addKnownType(className) {
      var str = '[object '+ className +']';
      knownTypes[str] = true;
    }

    function isKnownType(className) {
      return knownTypes[className];
    }

    function buildClassCheck(className, globalObject) {
      if (globalObject && isClass(new globalObject, 'Object')) {
        return getConstructorClassCheck(globalObject);
      } else {
        return getToStringClassCheck(className);
      }
    }

    function getConstructorClassCheck(obj) {
      var ctorStr = String(obj);
      return function(obj) {
        return String(obj.constructor) === ctorStr;
      };
    }

    function getToStringClassCheck(className) {
      return function(obj, str) {
        // perf: Returning up front on instanceof appears to be slower.
        return isClass(obj, className, str);
      };
    }

    function buildPrimitiveClassCheck(className) {
      var type = className.toLowerCase();
      return function(obj) {
        var t = typeof obj;
        return t === type || t === 'object' && isClass(obj, className);
      };
    }

    addCoreTypes();
    addArrayTypes();

    isSerializable = function(obj, className) {
      // Only known objects can be serialized. This notably excludes functions,
      // host objects, Symbols (which are matched by reference), and instances
      // of classes. The latter can arguably be matched by value, but
      // distinguishing between these and host objects -- which should never be
      // compared by value -- is very tricky so not dealing with it here.
      className = className || classToString(obj);
      return isKnownType(className) || isPlainObject(obj, className);
    };

  }

  function isClass(obj, className, str) {
    if (!str) {
      str = classToString(obj);
    }
    return str === '[object '+ className +']';
  }

  // Wrapping the core's "define" methods to
  // save a few bytes in the minified script.
  function wrapNamespace(method) {
    return function(sugarNamespace, arg1, arg2) {
      sugarNamespace[method](arg1, arg2);
    };
  }

  // Method define aliases
  var alias                       = wrapNamespace('alias'),
      defineStatic                = wrapNamespace('defineStatic'),
      defineInstance              = wrapNamespace('defineInstance'),
      defineStaticPolyfill        = wrapNamespace('defineStaticPolyfill'),
      defineInstancePolyfill      = wrapNamespace('defineInstancePolyfill'),
      defineInstanceAndStatic     = wrapNamespace('defineInstanceAndStatic'),
      defineInstanceWithArguments = wrapNamespace('defineInstanceWithArguments');

  function defineInstanceSimilar(sugarNamespace, set, fn, flags) {
    defineInstance(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function defineInstanceAndStaticSimilar(sugarNamespace, set, fn, flags) {
    defineInstanceAndStatic(sugarNamespace, collectSimilarMethods(set, fn), flags);
  }

  function collectSimilarMethods(set, fn) {
    var methods = {};
    if (isString(set)) {
      set = spaceSplit(set);
    }
    forEach(set, function(el, i) {
      fn(methods, el, i);
    });
    return methods;
  }

  // This song and dance is to fix methods to a different length
  // from what they actually accept in order to stay in line with
  // spec. Additionally passing argument length, as some methods
  // throw assertion errors based on this (undefined check is not
  // enough). Fortunately for now spec is such that passing 3
  // actual arguments covers all requirements. Note that passing
  // the argument length also forces the compiler to not rewrite
  // length of the compiled function.
  function fixArgumentLength(fn) {
    var staticFn = function(a) {
      var args = arguments;
      return fn(a, args[1], args[2], args.length - 1);
    };
    staticFn.instance = function(b) {
      var args = arguments;
      return fn(this, b, args[1], args.length);
    };
    return staticFn;
  }

  function defineAccessor(namespace, name, fn) {
    setProperty(namespace, name, fn);
  }

  function defineOptionsAccessor(namespace, defaults) {
    var obj = simpleClone(defaults);

    function getOption(name) {
      return obj[name];
    }

    function setOption(arg1, arg2) {
      var options;
      if (arguments.length === 1) {
        options = arg1;
      } else {
        options = {};
        options[arg1] = arg2;
      }
      forEachProperty(options, function(val, name) {
        if (val === null) {
          val = defaults[name];
        }
        obj[name] = val;
      });
    }

    defineAccessor(namespace, 'getOption', getOption);
    defineAccessor(namespace, 'setOption', setOption);
    return getOption;
  }

  // For methods defined directly on the prototype like Range
  function defineOnPrototype(ctor, methods) {
    var proto = ctor.prototype;
    forEachProperty(methods, function(val, key) {
      proto[key] = val;
    });
  }

  // Argument helpers

  function assertArgument(exists) {
    if (!exists) {
      throw new TypeError('Argument required');
    }
  }

  function assertCallable(obj) {
    if (!isFunction(obj)) {
      throw new TypeError('Function is not callable');
    }
  }

  function assertArray(obj) {
    if (!isArray(obj)) {
      throw new TypeError('Array required');
    }
  }

  function assertWritable(obj) {
    if (isPrimitive(obj)) {
      // If strict mode is active then primitives will throw an
      // error when attempting to write properties. We can't be
      // sure if strict mode is available, so pre-emptively
      // throw an error here to ensure consistent behavior.
      throw new TypeError('Property cannot be written');
    }
  }

  // Coerces an object to a positive integer.
  // Does not allow Infinity.
  function coercePositiveInteger(n) {
    n = +n || 0;
    if (n < 0 || !isNumber(n) || !isFinite(n)) {
      throw new RangeError('Invalid number');
    }
    return trunc(n);
  }


  // General helpers

  function isDefined(o) {
    return o !== undefined;
  }

  function isUndefined(o) {
    return o === undefined;
  }

  function privatePropertyAccessor(key) {
    var privateKey = PRIVATE_PROP_PREFIX + key;
    return function(obj, val) {
      if (arguments.length > 1) {
        setProperty(obj, privateKey, val);
        return obj;
      }
      return obj[privateKey];
    };
  }

  function setChainableConstructor(sugarNamespace, createFn) {
    sugarNamespace.prototype.constructor = function() {
      return createFn.apply(this, arguments);
    };
  }

  // Fuzzy matching helpers

  function getMatcher(f) {
    if (!isPrimitive(f)) {
      var className = classToString(f);
      if (isRegExp(f, className)) {
        return regexMatcher(f);
      } else if (isDate(f, className)) {
        return dateMatcher(f);
      } else if (isFunction(f, className)) {
        return functionMatcher(f);
      } else if (isPlainObject(f, className)) {
        return fuzzyMatcher(f);
      }
    }
    // Default is standard isEqual
    return defaultMatcher(f);
  }

  function fuzzyMatcher(obj) {
    var matchers = {};
    return function(el, i, arr) {
      var matched = true;
      if (!isObjectType(el)) {
        return false;
      }
      forEachProperty(obj, function(val, key) {
        matchers[key] = getOwn(matchers, key) || getMatcher(val);
        if (matchers[key].call(arr, el[key], i, arr) === false) {
          matched = false;
        }
        return matched;
      });
      return matched;
    };
  }

  function defaultMatcher(f) {
    return function(el) {
      return isEqual(el, f);
    };
  }

  function regexMatcher(reg) {
    reg = RegExp(reg);
    return function(el) {
      return reg.test(el);
    };
  }

  function dateMatcher(d) {
    var ms = d.getTime();
    return function(el) {
      return !!(el && el.getTime) && el.getTime() === ms;
    };
  }

  function functionMatcher(fn) {
    return function(el, i, arr) {
      // Return true up front if match by reference
      return el === fn || fn.call(arr, el, i, arr);
    };
  }

  // Object helpers

  function getKeys(obj) {
    return Object.keys(obj);
  }

  function deepHasProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, true);
  }

  function deepGetProperty(obj, key, any) {
    return handleDeepProperty(obj, key, any, false);
  }

  function deepSetProperty(obj, key, val) {
    handleDeepProperty(obj, key, false, false, true, false, val);
    return obj;
  }

  function handleDeepProperty(obj, key, any, has, fill, fillLast, val) {
    var ns, bs, ps, cbi, set, isLast, isPush, isIndex, nextIsIndex, exists;
    ns = obj || undefined;
    if (key == null) return;

    if (isObjectType(key)) {
      // Allow array and array-like accessors
      bs = [key];
    } else {
      key = String(key);
      if (key.indexOf('..') !== -1) {
        return handleArrayIndexRange(obj, key, any, val);
      }
      bs = key.split('[');
    }

    set = isDefined(val);

    for (var i = 0, blen = bs.length; i < blen; i++) {
      ps = bs[i];

      if (isString(ps)) {
        ps = periodSplit(ps);
      }

      for (var j = 0, plen = ps.length; j < plen; j++) {
        key = ps[j];

        // Is this the last key?
        isLast = i === blen - 1 && j === plen - 1;

        // Index of the closing ]
        cbi = key.indexOf(']');

        // Is the key an array index?
        isIndex = cbi !== -1;

        // Is this array push syntax "[]"?
        isPush = set && cbi === 0;

        // If the bracket split was successful and this is the last element
        // in the dot split, then we know the next key will be an array index.
        nextIsIndex = blen > 1 && j === plen - 1;

        if (isPush) {
          // Set the index to the end of the array
          key = ns.length;
        } else if (isIndex) {
          // Remove the closing ]
          key = key.slice(0, -1);
        }

        // If the array index is less than 0, then
        // add its length to allow negative indexes.
        if (isIndex && key < 0) {
          key = +key + ns.length;
        }

        // Bracket keys may look like users[5] or just [5], so the leading
        // characters are optional. We can enter the namespace if this is the
        // 2nd part, if there is only 1 part, or if there is an explicit key.
        if (i || key || blen === 1) {

          exists = any ? key in ns : hasOwn(ns, key);

          // Non-existent namespaces are only filled if they are intermediate
          // (not at the end) or explicitly filling the last.
          if (fill && (!isLast || fillLast) && !exists) {
            // For our purposes, last only needs to be an array.
            ns = ns[key] = nextIsIndex || (fillLast && isLast) ? [] : {};
            continue;
          }

          if (has) {
            if (isLast || !exists) {
              return exists;
            }
          } else if (set && isLast) {
            assertWritable(ns);
            ns[key] = val;
          }

          ns = exists ? ns[key] : undefined;
        }

      }
    }
    return ns;
  }

  // Get object property with support for 0..1 style range notation.
  function handleArrayIndexRange(obj, key, any, val) {
    var match, start, end, leading, trailing, arr, set;
    match = key.match(PROPERTY_RANGE_REG);
    if (!match) {
      return;
    }

    set = isDefined(val);
    leading = match[1];

    if (leading) {
      arr = handleDeepProperty(obj, leading, any, false, set ? true : false, true);
    } else {
      arr = obj;
    }

    assertArray(arr);

    trailing = match[4];
    start    = match[2] ? +match[2] : 0;
    end      = match[3] ? +match[3] : arr.length;

    // A range of 0..1 is inclusive, so we need to add 1 to the end. If this
    // pushes the index from -1 to 0, then set it to the full length of the
    // array, otherwise it will return nothing.
    end = end === -1 ? arr.length : end + 1;

    if (set) {
      for (var i = start; i < end; i++) {
        handleDeepProperty(arr, i + trailing, any, false, true, false, val);
      }
    } else {
      arr = arr.slice(start, end);

      // If there are trailing properties, then they need to be mapped for each
      // element in the array.
      if (trailing) {
        if (trailing.charAt(0) === HALF_WIDTH_PERIOD) {
          // Need to chomp the period if one is trailing after the range. We
          // can't do this at the regex level because it will be required if
          // we're setting the value as it needs to be concatentated together
          // with the array index to be set.
          trailing = trailing.slice(1);
        }
        return arr.map(function(el) {
          return handleDeepProperty(el, trailing);
        });
      }
    }
    return arr;
  }

  function getOwnKey(obj, key) {
    if (hasOwn(obj, key)) {
      return key;
    }
  }

  function hasProperty(obj, prop) {
    return !isPrimitive(obj) && prop in obj;
  }

  function isObjectType(obj, type) {
    return !!obj && (type || typeof obj) === 'object';
  }

  function isPrimitive(obj, type) {
    type = type || typeof obj;
    return obj == null || type === 'string' || type === 'number' || type === 'boolean';
  }

  function isPlainObject(obj, className) {
    return isObjectType(obj) &&
           isClass(obj, 'Object', className) &&
           hasValidPlainObjectPrototype(obj) &&
           hasOwnEnumeratedProperties(obj);
  }

  function hasValidPlainObjectPrototype(obj) {
    var hasToString = 'toString' in obj;
    var hasConstructor = 'constructor' in obj;
    // An object created with Object.create(null) has no methods in the
    // prototype chain, so check if any are missing. The additional hasToString
    // check is for false positives on some host objects in old IE which have
    // toString but no constructor. If the object has an inherited constructor,
    // then check if it is Object (the "isPrototypeOf" tapdance here is a more
    // robust way of ensuring this if the global has been hijacked). Note that
    // accessing the constructor directly (without "in" or "hasOwnProperty")
    // will throw a permissions error in IE8 on cross-domain windows.
    return (!hasConstructor && !hasToString) ||
            (hasConstructor && !hasOwn(obj, 'constructor') &&
             hasOwn(obj.constructor.prototype, 'isPrototypeOf'));
  }

  function hasOwnEnumeratedProperties(obj) {
    // Plain objects are generally defined as having enumerated properties
    // all their own, however in early IE environments without defineProperty,
    // there may also be enumerated methods in the prototype chain, so check
    // for both of these cases.
    var objectProto = Object.prototype;
    for (var key in obj) {
      var val = obj[key];
      if (!hasOwn(obj, key) && val !== objectProto[key]) {
        return false;
      }
    }
    return true;
  }

  function simpleRepeat(n, fn) {
    for (var i = 0; i < n; i++) {
      fn(i);
    }
  }

  function simpleClone(obj) {
    return simpleMerge({}, obj);
  }

  function simpleMerge(target, source) {
    forEachProperty(source, function(val, key) {
      target[key] = val;
    });
    return target;
  }

  // Make primtives types like strings into objects.
  function coercePrimitiveToObject(obj) {
    if (isPrimitive(obj)) {
      obj = Object(obj);
    }
    if (NO_KEYS_IN_STRING_OBJECTS && isString(obj)) {
      forceStringCoercion(obj);
    }
    return obj;
  }

  // Force strings to have their indexes set in
  // environments that don't do this automatically.
  function forceStringCoercion(obj) {
    var i = 0, chr;
    while (chr = obj.charAt(i)) {
      obj[i++] = chr;
    }
  }

  // Equality helpers

  function isEqual(a, b, stack) {
    var aClass, bClass;
    if (a === b) {
      // Return quickly up front when matched by reference,
      // but be careful about 0 !== -0.
      return a !== 0 || 1 / a === 1 / b;
    }
    aClass = classToString(a);
    bClass = classToString(b);
    if (aClass !== bClass) {
      return false;
    }

    if (isSerializable(a, aClass) && isSerializable(b, bClass)) {
      return objectIsEqual(a, b, aClass, stack);
    } else if (isSet(a, aClass) && isSet(b, bClass)) {
      return a.size === b.size && isEqual(setToArray(a), setToArray(b), stack);
    } else if (isMap(a, aClass) && isMap(b, bClass)) {
      return a.size === b.size && isEqual(mapToArray(a), mapToArray(b), stack);
    } else if (isError(a, aClass) && isError(b, bClass)) {
      return a.toString() === b.toString();
    }

    return false;
  }

  function objectIsEqual(a, b, aClass, stack) {
    var aType = typeof a, bType = typeof b, propsEqual, count;
    if (aType !== bType) {
      return false;
    }
    if (isObjectType(a.valueOf())) {
      if (a.length !== b.length) {
        // perf: Quickly returning up front for arrays.
        return false;
      }
      count = 0;
      propsEqual = true;
      iterateWithCyclicCheck(a, false, stack, function(key, val, cyc, stack) {
        if (!cyc && (!(key in b) || !isEqual(val, b[key], stack))) {
          propsEqual = false;
        }
        count++;
        return propsEqual;
      });
      if (!propsEqual || count !== getKeys(b).length) {
        return false;
      }
    }
    // Stringifying the value handles NaN, wrapped primitives, dates, and errors in one go.
    return a.valueOf().toString() === b.valueOf().toString();
  }

  // Serializes an object in a way that will provide a token unique
  // to the type, class, and value of an object. Host objects, class
  // instances etc, are not serializable, and are held in an array
  // of references that will return the index as a unique identifier
  // for the object. This array is passed from outside so that the
  // calling function can decide when to dispose of this array.
  function serializeInternal(obj, refs, stack) {
    var type = typeof obj, className, value, ref;

    // Return quickly for primitives to save cycles
    if (isPrimitive(obj, type) && !isRealNaN(obj)) {
      return type + obj;
    }

    className = classToString(obj);

    if (!isSerializable(obj, className)) {
      ref = indexOf(refs, obj);
      if (ref === -1) {
        ref = refs.length;
        refs.push(obj);
      }
      return ref;
    } else if (isObjectType(obj)) {
      value = serializeDeep(obj, refs, stack) + obj.toString();
    } else if (1 / obj === -Infinity) {
      value = '-0';
    } else if (obj.valueOf) {
      value = obj.valueOf();
    }
    return type + className + value;
  }

  function serializeDeep(obj, refs, stack) {
    var result = '';
    iterateWithCyclicCheck(obj, true, stack, function(key, val, cyc, stack) {
      result += cyc ? 'CYC' : key + serializeInternal(val, refs, stack);
    });
    return result;
  }

  function iterateWithCyclicCheck(obj, sortedKeys, stack, fn) {

    function next(val, key) {
      var cyc = false;

      // Allowing a step into the structure before triggering this check to save
      // cycles on standard JSON structures and also to try as hard as possible to
      // catch basic properties that may have been modified.
      if (stack.length > 1) {
        var i = stack.length;
        while (i--) {
          if (stack[i] === val) {
            cyc = true;
          }
        }
      }

      stack.push(val);
      fn(key, val, cyc, stack);
      stack.pop();
    }

    function iterateWithSortedKeys() {
      // Sorted keys is required for serialization, where object order
      // does not matter but stringified order does.
      var arr = getKeys(obj).sort(), key;
      for (var i = 0; i < arr.length; i++) {
        key = arr[i];
        next(obj[key], arr[i]);
      }
    }

    // This method for checking for cyclic structures was egregiously stolen from
    // the ingenious method by @kitcambridge from the Underscore script:
    // https://github.com/documentcloud/underscore/issues/240
    if (!stack) {
      stack = [];
    }

    if (sortedKeys) {
      iterateWithSortedKeys();
    } else {
      forEachProperty(obj, next);
    }
  }


  // Array helpers

  function isArrayIndex(n) {
    return n >>> 0 == n && n != 0xFFFFFFFF;
  }

  function iterateOverSparseArray(arr, fn, fromIndex, loop) {
    var indexes = getSparseArrayIndexes(arr, fromIndex, loop), index;
    for (var i = 0, len = indexes.length; i < len; i++) {
      index = indexes[i];
      fn.call(arr, arr[index], index, arr);
    }
    return arr;
  }

  // It's unclear whether or not sparse arrays qualify as "simple enumerables".
  // If they are not, however, the wrapping function will be deoptimized, so
  // isolate here (also to share between es5 and array modules).
  function getSparseArrayIndexes(arr, fromIndex, loop, fromRight) {
    var indexes = [], i;
    for (i in arr) {
      if (isArrayIndex(i) && (loop || (fromRight ? i <= fromIndex : i >= fromIndex))) {
        indexes.push(+i);
      }
    }
    indexes.sort(function(a, b) {
      var aLoop = a > fromIndex;
      var bLoop = b > fromIndex;
      if (aLoop !== bLoop) {
        return aLoop ? -1 : 1;
      }
      return a - b;
    });
    return indexes;
  }

  function getEntriesForIndexes(obj, find, loop, isString) {
    var result, length = obj.length;
    if (!isArray(find)) {
      return entryAtIndex(obj, find, length, loop, isString);
    }
    result = new Array(find.length);
    forEach(find, function(index, i) {
      result[i] = entryAtIndex(obj, index, length, loop, isString);
    });
    return result;
  }

  function getNormalizedIndex(index, length, loop) {
    if (index && loop) {
      index = index % length;
    }
    if (index < 0) index = length + index;
    return index;
  }

  function entryAtIndex(obj, index, length, loop, isString) {
    index = getNormalizedIndex(index, length, loop);
    return isString ? obj.charAt(index) : obj[index];
  }

  function mapWithShortcuts(el, f, context, mapArgs) {
    if (!f) {
      return el;
    } else if (f.apply) {
      return f.apply(context, mapArgs || []);
    } else if (isArray(f)) {
      return f.map(function(m) {
        return mapWithShortcuts(el, m, context, mapArgs);
      });
    } else if (isFunction(el[f])) {
      return el[f].call(el);
    } else {
      return deepGetProperty(el, f);
    }
  }

  function spaceSplit(str) {
    return str.split(' ');
  }

  function commaSplit(str) {
    return str.split(HALF_WIDTH_COMMA);
  }

  function periodSplit(str) {
    return str.split(HALF_WIDTH_PERIOD);
  }

  function forEach(arr, fn) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (!(i in arr)) {
        return iterateOverSparseArray(arr, fn, i);
      }
      fn(arr[i], i);
    }
  }

  function filter(arr, fn) {
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      var el = arr[i];
      if (i in arr && fn(el, i)) {
        result.push(el);
      }
    }
    return result;
  }

  function map(arr, fn) {
    // perf: Not using fixed array len here as it may be sparse.
    var result = [];
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr) {
        result.push(fn(arr[i], i));
      }
    }
    return result;
  }

  function indexOf(arr, el) {
    for (var i = 0, len = arr.length; i < len; i++) {
      if (i in arr && arr[i] === el) return i;
    }
    return -1;
  }

  // Number helpers

  var trunc = Math.trunc || function(n) {
    if (n === 0 || !isFinite(n)) return n;
    return n < 0 ? ceil(n) : floor(n);
  };

  function isRealNaN(obj) {
    // This is only true of NaN
    return obj != null && obj !== obj;
  }

  function withPrecision(val, precision, fn) {
    var multiplier = pow(10, abs(precision || 0));
    fn = fn || round;
    if (precision < 0) multiplier = 1 / multiplier;
    return fn(val * multiplier) / multiplier;
  }

  function padNumber(num, place, sign, base, replacement) {
    var str = abs(num).toString(base || 10);
    str = repeatString(replacement || '0', place - str.replace(/\.\d+/, '').length) + str;
    if (sign || num < 0) {
      str = (num < 0 ? '-' : '+') + str;
    }
    return str;
  }

  function getOrdinalSuffix(num) {
    if (num >= 11 && num <= 13) {
      return 'th';
    } else {
      switch(num % 10) {
        case 1:  return 'st';
        case 2:  return 'nd';
        case 3:  return 'rd';
        default: return 'th';
      }
    }
  }

  // Fullwidth number helpers
  var fullWidthNumberReg, fullWidthNumberMap, fullWidthNumbers;

  function buildFullWidthNumber() {
    var fwp = FULL_WIDTH_PERIOD, hwp = HALF_WIDTH_PERIOD, hwc = HALF_WIDTH_COMMA, fwn = '';
    fullWidthNumberMap = {};
    for (var i = 0, digit; i <= 9; i++) {
      digit = chr(i + FULL_WIDTH_ZERO);
      fwn += digit;
      fullWidthNumberMap[digit] = chr(i + HALF_WIDTH_ZERO);
    }
    fullWidthNumberMap[hwc] = '';
    fullWidthNumberMap[fwp] = hwp;
    // Mapping this to itself to capture it easily
    // in stringToNumber to detect decimals later.
    fullWidthNumberMap[hwp] = hwp;
    fullWidthNumberReg = allCharsReg(fwn + fwp + hwc + hwp);
    fullWidthNumbers = fwn;
  }

  // Takes into account full-width characters, commas, and decimals.
  function stringToNumber(str, base) {
    var sanitized, isDecimal;
    sanitized = str.replace(fullWidthNumberReg, function(chr) {
      var replacement = getOwn(fullWidthNumberMap, chr);
      if (replacement === HALF_WIDTH_PERIOD) {
        isDecimal = true;
      }
      return replacement;
    });
    return isDecimal ? parseFloat(sanitized) : parseInt(sanitized, base || 10);
  }

  // Math aliases
  var abs   = Math.abs,
      pow   = Math.pow,
      min   = Math.min,
      max   = Math.max,
      ceil  = Math.ceil,
      floor = Math.floor,
      round = Math.round;


  // String helpers

  var chr = String.fromCharCode;

  function trim(str) {
    return str.trim();
  }

  function repeatString(str, num) {
    var result = '';
    str = str.toString();
    while (num > 0) {
      if (num & 1) {
        result += str;
      }
      if (num >>= 1) {
        str += str;
      }
    }
    return result;
  }

  function simpleCapitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function createFormatMatcher(bracketMatcher, percentMatcher, precheck) {

    var reg = STRING_FORMAT_REG;
    var compileMemoized = memoizeFunction(compile);

    function getToken(format, match) {
      var get, token, literal, fn;
      var bKey = match[2];
      var pLit = match[3];
      var pKey = match[5];
      if (match[4] && percentMatcher) {
        token = pKey;
        get = percentMatcher;
      } else if (bKey) {
        token = bKey;
        get = bracketMatcher;
      } else if (pLit && percentMatcher) {
        literal = pLit;
      } else {
        literal = match[1] || match[0];
      }
      if (get) {
        assertPassesPrecheck(precheck, bKey, pKey);
        fn = function(obj, opt) {
          return get(obj, token, opt);
        };
      }
      format.push(fn || getLiteral(literal));
    }

    function getSubstring(format, str, start, end) {
      if (end > start) {
        var sub = str.slice(start, end);
        assertNoUnmatched(sub, OPEN_BRACE);
        assertNoUnmatched(sub, CLOSE_BRACE);
        format.push(function() {
          return sub;
        });
      }
    }

    function getLiteral(str) {
      return function() {
        return str;
      };
    }

    function assertPassesPrecheck(precheck, bt, pt) {
      if (precheck && !precheck(bt, pt)) {
        throw new TypeError('Invalid token '+ (bt || pt) +' in format string');
      }
    }

    function assertNoUnmatched(str, chr) {
      if (str.indexOf(chr) !== -1) {
        throw new TypeError('Unmatched '+ chr +' in format string');
      }
    }

    function compile(str) {
      var format = [], lastIndex = 0, match;
      reg.lastIndex = 0;
      while(match = reg.exec(str)) {
        getSubstring(format, str, lastIndex, match.index);
        getToken(format, match);
        lastIndex = reg.lastIndex;
      }
      getSubstring(format, str, lastIndex, str.length);
      return format;
    }

    return function(str, obj, opt) {
      var format = compileMemoized(str), result = '';
      for (var i = 0; i < format.length; i++) {
        result += format[i](obj, opt);
      }
      return result;
    };
  }

  // Inflection helper

  var Inflections = {};

  function getAcronym(str) {
    return Inflections.acronyms && Inflections.acronyms.find(str);
  }

  function getHumanWord(str) {
    return Inflections.human && Inflections.human.find(str);
  }

  function runHumanRules(str) {
    return Inflections.human && Inflections.human.runRules(str) || str;
  }

  // RegExp helpers

  function allCharsReg(src) {
    return RegExp('[' + src + ']', 'g');
  }

  function getRegExpFlags(reg, add) {
    var flags = '';
    add = add || '';
    function checkFlag(prop, flag) {
      if (prop || add.indexOf(flag) > -1) {
        flags += flag;
      }
    }
    checkFlag(reg.global, 'g');
    checkFlag(reg.ignoreCase, 'i');
    checkFlag(reg.multiline, 'm');
    checkFlag(reg.sticky, 'y');
    return flags;
  }

  function escapeRegExp(str) {
    if (!isString(str)) str = String(str);
    return str.replace(/([\\\/\'*+?|()\[\]{}.^$-])/g,'\\$1');
  }

  // Date helpers

  var _utc = privatePropertyAccessor('utc');

  function callDateGet(d, method) {
    return d['get' + (_utc(d) ? 'UTC' : '') + method]();
  }

  function callDateSet(d, method, value, safe) {
    // "Safe" denotes not setting the date if the value is the same as what is
    // currently set. In theory this should be a noop, however it will cause
    // timezone shifts when in the middle of a DST fallback. This is unavoidable
    // as the notation itself is ambiguous (i.e. there are two "1:00ams" on
    // November 1st, 2015 in northern hemisphere timezones that follow DST),
    // however when advancing or rewinding dates this can throw off calculations
    // so avoiding this unintentional shifting on an opt-in basis.
    if (safe && value === callDateGet(d, method, value)) {
      return;
    }
    d['set' + (_utc(d) ? 'UTC' : '') + method](value);
  }

  // Memoization helpers

  var INTERNAL_MEMOIZE_LIMIT = 1000;

  // Note that attemps to consolidate this with Function#memoize
  // ended up clunky as that is also serializing arguments. Separating
  // these implementations turned out to be simpler.
  function memoizeFunction(fn) {
    var memo = {}, counter = 0;

    return function(key) {
      if (hasOwn(memo, key)) {
        return memo[key];
      }
      if (counter === INTERNAL_MEMOIZE_LIMIT) {
        memo = {};
        counter = 0;
      }
      counter++;
      return memo[key] = fn(key);
    };
  }

  // ES6 helpers

  function setToArray(set) {
    var arr = new Array(set.size), i = 0;
    set.forEach(function(val) {
      arr[i++] = val;
    });
    return arr;
  }

  function mapToArray(map) {
    var arr = new Array(map.size), i = 0;
    map.forEach(function(val, key) {
      arr[i++] = [key, val];
    });
    return arr;
  }

  buildClassChecks();
  buildFullWidthNumber();

  /***
   * @module ES6
   * @description Polyfills that provide basic ES6 compatibility. This module
   *              provides the base for Sugar functionality, but is not a full
   *              polyfill suite.
   *
   ***/


  /*** @namespace Array ***/

  function getCoercedObject(obj) {
    if (obj == null) {
      throw new TypeError('Object required.');
    }
    return coercePrimitiveToObject(obj);
  }

  defineStaticPolyfill(sugarArray, {

    /***
     * @method from(a, [map], [context])
     * @returns Mixed
     * @polyfill ES6
     * @static
     * @short Creates an array from an array-like object.
     * @extra If a function is passed for [map], it will be map each element of
     *        the array. [context] is the `this` object if passed.
     *
     * @callback map
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   Array.from({0:'a',1:'b',length:2}); -> ['a','b']
     *
     ***/
    'from': function(a) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, map = arguments[1], context = arguments[2];
      var len, arr;
      if (isDefined(map)) {
        assertCallable(map);
      }
      a = getCoercedObject(a);
      len = trunc(max(0, a.length || 0));
      if (!isArrayIndex(len)) {
        throw new RangeError('Invalid array length');
      }
      if (isFunction(this)) {
        arr = new this(len);
        arr.length = len;
      } else {
        arr = new Array(len);
      }
      for (var i = 0; i < len; i++) {
        setProperty(arr, i, isDefined(map) ? map.call(context, a[i], i) : a[i], true);
      }
      return arr;
    }

  });

  defineInstancePolyfill(sugarArray, {

    'find': function(f) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      assertCallable(f);
      for (var i = 0, len = this.length; i < len; i++) {
        if (f.call(context, this[i], i, this)) {
          return this[i];
        }
      }
    },

    'findIndex': function(f) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, context = arguments[1];
      assertCallable(f);
      for (var i = 0, len = this.length; i < len; i++) {
        if (f.call(context, this[i], i, this)) {
          return i;
        }
      }
      return -1;
    }

  });

  /***
   * @module ES7
   * @description Polyfills that provide basic ES7 compatibility. This module
   *              provides the base for Sugar functionality, but is not a full
   *              polyfill suite.
   *
   ***/


  /*** @namespace Array ***/

  function sameValueZero(a, b) {
    if (isRealNaN(a)) {
      return isRealNaN(b);
    }
    return a === b ? a !== 0 || 1 / a === 1 / b : false;
  }

  defineInstancePolyfill(sugarArray, {

    /***
     * @method includes(search, [fromIndex] = 0)
     * @returns Boolean
     * @polyfill ES7
     * @short Returns true if `search` is contained within the array.
     * @extra Search begins at [fromIndex], which defaults to the beginning of the
     *        array.
     *
     * @example
     *
     *   [1,2,3].includes(2)    -> true
     *   [1,2,3].includes(4)    -> false
     *   [1,2,3].includes(2, 3) -> false
     *
     ***/
    'includes': function(search) {
      // Force compiler to respect argument length.
      var argLen = arguments.length, fromIndex = arguments[1];
      var arr = this, len;
      if (isString(arr)) return arr.includes(search, fromIndex);
      fromIndex = fromIndex ? fromIndex.valueOf() : 0;
      len = arr.length;
      if (fromIndex < 0) {
        fromIndex = max(0, fromIndex + len);
      }
      for (var i = fromIndex; i < len; i++) {
        if (sameValueZero(search, arr[i])) {
          return true;
        }
      }
      return false;
    }

  });

  /***
   * @module Enumerable
   * @description Counting, mapping, and finding methods on both arrays and objects.
   *
   ***/

  function sum(obj, map) {
    var sum = 0;
    enumerateWithMapping(obj, map, function(val) {
      sum += val;
    });
    return sum;
  }

  function average(obj, map) {
    var sum = 0, count = 0;
    enumerateWithMapping(obj, map, function(val) {
      sum += val;
      count++;
    });
    // Prevent divide by 0
    return sum / (count || 1);
  }

  function median(obj, map) {
    var result = [], middle, len;
    enumerateWithMapping(obj, map, function(val) {
      result.push(val);
    });
    len = result.length;
    if (!len) return 0;
    result.sort(function(a, b) {
      // IE7 will throw errors on non-numbers!
      return (a || 0) - (b || 0);
    });
    middle = trunc(len / 2);
    return len % 2 ? result[middle] : (result[middle - 1] + result[middle]) / 2;
  }

  function getMinOrMax(obj, arg1, arg2, max, asObject) {
    var result = [], pushVal, edge, all, map;
    if (isBoolean(arg1)) {
      all = arg1;
      map = arg2;
    } else {
      map = arg1;
    }
    enumerateWithMapping(obj, map, function(val, key) {
      if (isUndefined(val)) {
        throw new TypeError('Cannot compare with undefined');
      }
      pushVal = asObject ? key : obj[key];
      if (val === edge) {
        result.push(pushVal);
      } else if (isUndefined(edge) || (max && val > edge) || (!max && val < edge)) {
        result = [pushVal];
        edge = val;
      }
    });
    return getReducedMinMaxResult(result, obj, all, asObject);
  }

  function getLeastOrMost(obj, arg1, arg2, most, asObject) {
    var group = {}, refs = [], minMaxResult, result, all, map;
    if (isBoolean(arg1)) {
      all = arg1;
      map = arg2;
    } else {
      map = arg1;
    }
    enumerateWithMapping(obj, map, function(val, key) {
      var groupKey = serializeInternal(val, refs);
      var arr = getOwn(group, groupKey) || [];
      arr.push(asObject ? key : obj[key]);
      group[groupKey] = arr;
    });
    minMaxResult = getMinOrMax(group, !!all, 'length', most, true);
    if (all) {
      result = [];
      // Flatten result
      forEachProperty(minMaxResult, function(val) {
        result = result.concat(val);
      });
    } else {
      result = getOwn(group, minMaxResult);
    }
    return getReducedMinMaxResult(result, obj, all, asObject);
  }


  // Support

  function getReducedMinMaxResult(result, obj, all, asObject) {
    if (asObject && all) {
      // The method has returned an array of keys so use this array
      // to build up the resulting object in the form we want it in.
      return result.reduce(function(o, key) {
        o[key] = obj[key];
        return o;
      }, {});
    } else if (result && !all) {
      result = result[0];
    }
    return result;
  }

  function enumerateWithMapping(obj, map, fn) {
    var arrayIndexes = isArray(obj);
    forEachProperty(obj, function(val, key) {
      if (arrayIndexes) {
        if (!isArrayIndex(key)) {
          return;
        }
        key = +key;
      }
      var mapped = mapWithShortcuts(val, map, obj, [val, key, obj]);
      fn(mapped, key);
    });
  }

  /*** @namespace Array ***/

  // Flag allowing native array methods to be enhanced
  var ARRAY_ENHANCEMENTS_FLAG = 'enhanceArray';

  // Enhanced map function
  var enhancedMap = buildEnhancedMapping('map');

  // Enhanced matcher methods
  var enhancedFind      = buildEnhancedMatching('find'),
      enhancedSome      = buildEnhancedMatching('some'),
      enhancedEvery     = buildEnhancedMatching('every'),
      enhancedFilter    = buildEnhancedMatching('filter'),
      enhancedFindIndex = buildEnhancedMatching('findIndex');

  function arrayNone() {
    return !enhancedSome.apply(this, arguments);
  }

  function arrayCount(arr, f) {
    if (isUndefined(f)) {
      return arr.length;
    }
    return enhancedFilter.apply(this, arguments).length;
  }

  // Enhanced methods

  function buildEnhancedMapping(name) {
    return wrapNativeArrayMethod(name, enhancedMapping);
  }


  function buildEnhancedMatching(name) {
    return wrapNativeArrayMethod(name, enhancedMatching);
  }

  function enhancedMapping(map, context) {
    if (isFunction(map)) {
      return map;
    } else if (map) {
      return function(el, i, arr) {
        return mapWithShortcuts(el, map, context, [el, i, arr]);
      };
    }
  }

  function enhancedMatching(f) {
    var matcher;
    if (isFunction(f)) {
      return f;
    }
    matcher = getMatcher(f);
    return function(el, i, arr) {
      return matcher(el, i, arr);
    };
  }

  function wrapNativeArrayMethod(methodName, wrapper) {
    var nativeFn = Array.prototype[methodName];
    return function(arr, f, context, argsLen) {
      var args = new Array(2);
      assertArgument(argsLen > 0);
      args[0] = wrapper(f, context);
      args[1] = context;
      return nativeFn.apply(arr, args);
    };
  }


  /***
   * @method [fn]FromIndex(startIndex, [loop], ...)
   * @returns Mixed
   * @short Runs native array functions beginning from `startIndex`.
   * @extra If [loop] is `true`, once the end of the array has been reached,
   *        iteration will continue from the start of the array up to
   *        `startIndex - 1`. If [loop] is false it can be omitted. Standard
   *        arguments are then passed which will be forwarded to the native
   *        methods. When available, methods are always `enhanced`. This includes
   *        `deep properties` for `map`, and `enhanced matching` for `some`,
   *        `every`, `filter`, `find`, and `findIndex`. Note also that
   *        `forEachFromIndex` is optimized for sparse arrays and may be faster
   *        than native `forEach`.
   *
   * @set
   *   mapFromIndex
   *   forEachFromIndex
   *   filterFromIndex
   *   someFromIndex
   *   everyFromIndex
   *   reduceFromIndex
   *   reduceRightFromIndex
   *   findFromIndex
   *   findIndexFromIndex
   *
   * @example
   *
   *   users.mapFromIndex(2, 'name');
   *   users.mapFromIndex(2, true, 'name');
   *   names.forEachFromIndex(10, log);
   *   names.everyFromIndex(15, /^[A-F]/);
   *
   * @signature [fn]FromIndex(startIndex, ...)
   * @param {number} startIndex
   * @param {boolean} loop
   *
   ***/
  function buildFromIndexMethods() {

    var methods = {
      'forEach': {
        base: forEachAsNative
      },
      'map': {
        wrapper: enhancedMapping
      },
      'some every': {
        wrapper: enhancedMatching
      },
      'findIndex': {
        wrapper: enhancedMatching,
        result: indexResult
      },
      'reduce': {
        apply: applyReduce
      },
      'filter find': {
        wrapper: enhancedMatching
      },
      'reduceRight': {
        apply: applyReduce,
        slice: sliceArrayFromRight,
        clamp: clampStartIndexFromRight
      }
    };

    forEachProperty(methods, function(opts, key) {
      forEach(spaceSplit(key), function(baseName) {
        var methodName = baseName + 'FromIndex';
        var fn = createFromIndexWithOptions(baseName, opts);
        defineInstanceWithArguments(sugarArray, methodName, fn);
      });
    });

    function forEachAsNative(fn) {
      forEach(this, fn);
    }

    // Methods like filter and find have a direct association between the value
    // returned by the callback and the element of the current iteration. This
    // means that when looping, array elements must match the actual index for
    // which they are being called, so the array must be sliced. This is not the
    // case for methods like forEach and map, which either do not use return
    // values or use them in a way that simply getting the element at a shifted
    // index will not affect the final return value. However, these methods will
    // still fail on sparse arrays, so always slicing them here. For example, if
    // "forEachFromIndex" were to be called on [1,,2] from index 1, although the
    // actual index 1 would itself would be skipped, when the array loops back to
    // index 0, shifting it by adding 1 would result in the element for that
    // iteration being undefined. For shifting to work, all gaps in the array
    // between the actual index and the shifted index would have to be accounted
    // for. This is infeasible and is easily solved by simply slicing the actual
    // array instead so that gaps align. Note also that in the case of forEach,
    // we are using the internal function which handles sparse arrays in a way
    // that does not increment the index, and so is highly optimized compared to
    // the others here, which are simply going through the native implementation.
    function sliceArrayFromLeft(arr, startIndex, loop) {
      var result = arr;
      if (startIndex) {
        result = arr.slice(startIndex);
        if (loop) {
          result = result.concat(arr.slice(0, startIndex));
        }
      }
      return result;
    }

    // When iterating from the right, indexes are effectively shifted by 1.
    // For example, iterating from the right from index 2 in an array of 3
    // should also include the last element in the array. This matches the
    // "lastIndexOf" method which also iterates from the right.
    function sliceArrayFromRight(arr, startIndex, loop) {
      if (!loop) {
        startIndex += 1;
        arr = arr.slice(0, max(0, startIndex));
      }
      return arr;
    }

    function clampStartIndex(startIndex, len) {
      return min(len, max(0, startIndex));
    }

    // As indexes are shifted by 1 when starting from the right, clamping has to
    // go down to -1 to accommodate the full range of the sliced array.
    function clampStartIndexFromRight(startIndex, len) {
      return min(len, max(-1, startIndex));
    }

    function applyReduce(arr, startIndex, fn, context, len, loop) {
      return function(acc, val, i) {
        i = getNormalizedIndex(i + startIndex, len, loop);
        return fn.call(arr, acc, val, i, arr);
      };
    }

    function applyEach(arr, startIndex, fn, context, len, loop) {
      return function(el, i) {
        i = getNormalizedIndex(i + startIndex, len, loop);
        return fn.call(context, arr[i], i, arr);
      };
    }

    function indexResult(result, startIndex, len) {
      if (result !== -1) {
        result = (result + startIndex) % len;
      }
      return result;
    }

    function createFromIndexWithOptions(methodName, opts) {

      var baseFn = opts.base || Array.prototype[methodName],
          applyCallback = opts.apply || applyEach,
          sliceArray = opts.slice || sliceArrayFromLeft,
          clampIndex = opts.clamp || clampStartIndex,
          getResult = opts.result,
          wrapper = opts.wrapper;

      return function(arr, startIndex, args) {
        var callArgs = [], argIndex = 0, lastArg, result, len, loop, fn;
        len = arr.length;
        if (isBoolean(args[0])) {
          loop = args[argIndex++];
        }
        fn = args[argIndex++];
        lastArg = args[argIndex];
        if (startIndex < 0) {
          startIndex += len;
        }
        startIndex = clampIndex(startIndex, len);
        assertArgument(args.length);
        fn = wrapper ? wrapper(fn, lastArg) : fn;
        callArgs.push(applyCallback(arr, startIndex, fn, lastArg, len, loop));
        if (lastArg) {
          callArgs.push(lastArg);
        }
        result = baseFn.apply(sliceArray(arr, startIndex, loop), callArgs);
        if (getResult) {
          result = getResult(result, startIndex, len);
        }
        return result;
      };
    }
  }

  defineInstance(sugarArray, {

    /***
     * @method map(map, [context])
     * @returns New Array
     * @polyfill ES5
     * @short Maps the array to another array whose elements are the values
     *        returned by the `map` callback.
     * @extra [context] is the `this` object. Sugar enhances this method to accept
     *        a string for `map`, which is a shortcut for a function that gets
     *        a property or invokes a function on each element.
     *        Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3].map(function(n) {
     *     return n * 3;
     *   }); -> [3,6,9]
     *
     *   ['a','aa','aaa'].map('length') -> [1,2,3]
     *   ['A','B','C'].map('toLowerCase') -> ['a','b','c']
     *   users.map('name') -> array of user names
     *
     * @param {string|mapFn} map
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'map': fixArgumentLength(enhancedMap),

    /***
     * @method some(search, [context])
     * @returns Boolean
     * @polyfill ES5
     * @short Returns true if `search` is true for any element in the array.
     * @extra [context] is the `this` object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   ['a','b','c'].some(function(n) {
     *     return n == 'a';
     *   });
     *   ['a','b','c'].some(function(n) {
     *     return n == 'd';
     *   });
     *   ['a','b','c'].some('a')    -> true
     *   [{a:2},{b:5}].some({a:2})  -> true
     *   users.some({ name: /^H/ }) -> true if any have a name starting with H
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'some': fixArgumentLength(enhancedSome),

    /***
     * @method every(search, [context])
     * @returns Boolean
     * @polyfill ES5
     * @short Returns true if `search` is true for all elements of the array.
     * @extra [context] is the `this` object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   ['a','a','a'].every(function(n) {
     *     return n == 'a';
     *   });
     *   ['a','a','a'].every('a')   -> true
     *   [{a:2},{a:2}].every({a:2}) -> true
     *   users.every({ name: /^H/ }) -> true if all have a name starting with H
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'every': fixArgumentLength(enhancedEvery),

    /***
     * @method filter(search, [context])
     * @returns Array
     * @polyfill ES5
     * @short Returns any elements in the array that match `search`.
     * @extra [context] is the `this` object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3].filter(function(n) {
     *     return n > 1;
     *   });
     *   [1,2,2,4].filter(2) -> 2
     *   users.filter({ name: /^H/ }) -> all users with a name starting with H
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'filter': fixArgumentLength(enhancedFilter),

    /***
     * @method find(search, [context])
     * @returns Mixed
     * @polyfill ES6
     * @short Returns the first element in the array that matches `search`.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   users.find(function(user) {
     *     return user.name = 'Harry';
     *   }); -> harry!
     *
     *   users.find({ name: 'Harry' }); -> harry!
     *   users.find({ name: /^[A-H]/ });  -> First user with name starting with A-H
     *   users.find({ titles: ['Ms', 'Dr'] }); -> not harry!
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'find': fixArgumentLength(enhancedFind),

    /***
     * @method findIndex(search, [context])
     * @returns Number
     * @polyfill ES6
     * @short Returns the index of the first element in the array that matches
     *        `search`, or `-1` if none.
     * @extra [context] is the `this` object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3,4].findIndex(function(n) {
     *     return n % 2 == 0;
     *   }); -> 1
     *   ['a','b','c'].findIndex('c');        -> 2
     *   ['cuba','japan','canada'].find(/^c/) -> 0
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'findIndex': fixArgumentLength(enhancedFindIndex)

  }, [ENHANCEMENTS_FLAG, ARRAY_ENHANCEMENTS_FLAG]);


  defineInstance(sugarArray, {

    /***
     * @method none(search, [context])
     *
     * @returns Boolean
     * @short Returns true if none of the elements in the array match `search`.
     * @extra [context] is the `this` object. Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3].none(5)         -> true
     *   ['a','b','c'].none(/b/) -> false
     *   users.none(function(user) {
     *     return user.name == 'Wolverine';
     *   }); -> probably true
     *   users.none({ name: 'Wolverine' }); -> same as above
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'none': fixArgumentLength(arrayNone),

    /***
     * @method count(search, [context])
     * @returns Number
     * @short Counts all elements in the array that match `search`.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   ['a','b','a'].count('a') -> 2
     *   ['a','b','c'].count(/b/) -> 1
     *   users.count(function(user) {
     *     return user.age > 30;
     *   }); -> number of users older than 30
     *
     * @param {ArrayElement|searchFn} search
     * @param {any} context
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'count': fixArgumentLength(arrayCount),

    /***
     * @method min([all] = false, [map])
     * @returns Mixed
     * @short Returns the element in the array with the lowest value.
     * @extra [map] may be passed in place of [all], and is a function mapping the
     *        value to be checked or a string acting as a shortcut. If [all] is
     *        true, multiple elements will be returned. Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3].min()                          -> 1
     *   ['fee','fo','fum'].min('length')       -> 'fo'
     *   ['fee','fo','fum'].min(true, 'length') -> ['fo']
     *   users.min('age')                       -> youngest guy!
     *
     *   ['fee','fo','fum'].min(true, function(n) {
     *     return n.length;
     *   }); -> ['fo']
     *
     * @signature min([map])
     * @param {string|mapFn} map
     * @param {boolean} all
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'min': function(arr, all, map) {
      return getMinOrMax(arr, all, map);
    },

    /***
     * @method max([all] = false, [map])
     * @returns Mixed
     * @short Returns the element in the array with the greatest value.
     * @extra [map] may be passed in place of [all], and is a function mapping the
     *        value to be checked or a string acting as a shortcut. If [all] is
     *        true, multiple elements will be returned. Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3].max()                          -> 3
     *   ['fee','fo','fum'].max('length')       -> 'fee'
     *   ['fee','fo','fum'].max(true, 'length') -> ['fee','fum']
     *   users.max('age')                       -> oldest guy!
     *
     *   ['fee','fo','fum'].max(true, function(n) {
     *     return n.length;
     *   }); -> ['fee', 'fum']
     *
     * @signature max([map])
     * @param {string|mapFn} map
     * @param {boolean} all
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'max': function(arr, all, map) {
      return getMinOrMax(arr, all, map, true);
    },

    /***
     * @method least([all] = false, [map])
     * @returns Array
     * @short Returns the elements in the array with the least commonly occuring value.
     * @extra [map] may be passed in place of [all], and is a function mapping the
     *        value to be checked or a string acting as a shortcut. If [all] is
     *        true, will return multiple values in an array.
     *        Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [3,2,2].least() -> 3
     *   ['fe','fo','fum'].least(true, 'length') -> ['fum']
     *   users.least('profile.type')             -> (user with least commonly occurring type)
     *   users.least(true, 'profile.type')       -> (users with least commonly occurring type)
     *
     * @signature least([map])
     * @param {string|mapFn} map
     * @param {boolean} all
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'least': function(arr, all, map) {
      return getLeastOrMost(arr, all, map);
    },

    /***
     * @method most([all] = false, [map])
     * @returns Array
     * @short Returns the elements in the array with the most commonly occuring value.
     * @extra [map] may be passed in place of [all], and is a function mapping the
     *        value to be checked or a string acting as a shortcut. If [all] is
     *        true, will return multiple values in an array.
     *        Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [3,2,2].most(2) -> 2
     *   ['fe','fo','fum'].most(true, 'length') -> ['fe','fo']
     *   users.most('profile.type')             -> (user with most commonly occurring type)
     *   users.most(true, 'profile.type')       -> (users with most commonly occurring type)
     *
     * @signature most([map])
     * @param {string|mapFn} map
     * @param {boolean} all
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'most': function(arr, all, map) {
      return getLeastOrMost(arr, all, map, true);
    },

    /***
     * @method sum([map])
     * @returns Number
     * @short Sums all values in the array.
     * @extra [map] may be a function mapping the value to be summed or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,2].sum() -> 5
     *   users.sum(function(user) {
     *     return user.votes;
     *   }); -> total votes!
     *   users.sum('votes') -> total votes!
     *
     * @param {string|mapFn} map
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'sum': function(arr, map) {
      return sum(arr, map);
    },

    /***
     * @method average([map])
     * @returns Number
     * @short Gets the mean average for all values in the array.
     * @extra [map] may be a function mapping the value to be averaged or a string
     *        acting as a shortcut. Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,3,4].average() -> 2
     *   users.average(function(user) {
     *     return user.age;
     *   }); -> average user age
     *   users.average('age') -> average user age
     *   users.average('currencies.usd.balance') -> average USD balance
     *
     * @param {string|mapFn} map
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'average': function(arr, map) {
      return average(arr, map);
    },

    /***
     * @method median([map])
     * @returns Number
     * @short Gets the median average for all values in the array.
     * @extra [map] may be a function mapping the value to be averaged or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   el   The element of the current iteration.
     *   i    The index of the current iteration.
     *   arr  A reference to the array.
     *
     * @example
     *
     *   [1,2,2].median() -> 2
     *   [{a:1},{a:2},{a:2}].median('a') -> 2
     *   users.median('age') -> median user age
     *   users.median('currencies.usd.balance') -> median USD balance
     *
     * @param {string|mapFn} map
     * @callbackParam {ArrayElement} el
     * @callbackParam {number} i
     * @callbackParam {Array} arr
     * @callbackReturns {NewArrayElement} mapFn
     *
     ***/
    'median': function(arr, map) {
      return median(arr, map);
    }

  });


  /*** @namespace Object ***/

  // Object matchers
  var objectSome  = wrapObjectMatcher('some'),
      objectFind  = wrapObjectMatcher('find'),
      objectEvery = wrapObjectMatcher('every');

  function objectForEach(obj, fn) {
    assertCallable(fn);
    forEachProperty(obj, function(val, key) {
      fn(val, key, obj);
    });
    return obj;
  }

  function objectMap(obj, map) {
    var result = {};
    forEachProperty(obj, function(val, key) {
      result[key] = mapWithShortcuts(val, map, obj, [val, key, obj]);
    });
    return result;
  }

  function objectReduce(obj, fn, acc) {
    var init = isDefined(acc);
    forEachProperty(obj, function(val, key) {
      if (!init) {
        acc = val;
        init = true;
        return;
      }
      acc = fn(acc, val, key, obj);
    });
    return acc;
  }

  function objectNone(obj, f) {
    return !objectSome(obj, f);
  }

  function objectFilter(obj, f) {
    var matcher = getMatcher(f), result = {};
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        result[key] = val;
      }
    });
    return result;
  }

  function objectCount(obj, f) {
    var matcher = getMatcher(f), count = 0;
    forEachProperty(obj, function(val, key) {
      if (matcher(val, key, obj)) {
        count++;
      }
    });
    return count;
  }

  // Support

  function wrapObjectMatcher(name) {
    var nativeFn = Array.prototype[name];
    return function(obj, f) {
      var matcher = getMatcher(f);
      return nativeFn.call(getKeys(obj), function(key) {
        return matcher(obj[key], key, obj);
      });
    };
  }

  defineInstanceAndStatic(sugarObject, {

    /***
     * @method forEach(fn)
     * @returns Object
     * @short Runs `fn` against each property in the object.
     * @extra Does not iterate over inherited or non-enumerable properties.
     *
     * @callback eachFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.forEach({a:'b'}, function(val, key) {
     *     // val = 'b', key = a
     *   });
     *
     * @param {eachFn} fn
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     *
     ***/
    'forEach': function(obj, fn) {
      return objectForEach(obj, fn);
    },

    /***
     * @method map(map)
     * @returns Object
     * @short Maps the object to another object whose properties are the values
     *        returned by `map`.
     * @extra `map` can also be a string, which is a shortcut for a function that
     *        gets that property (or invokes a function) on each element.
     *        Supports `deep properties`.
     *
     * @callback mapFn
     *
     *   val  The value of the current property.
     *   key  The key of the current property.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   data.map(function(val, key) {
     *     return key;
     *   }); -> {a:'b'}
     *   users.map('age');
     *
     * @param {string|mapFn} map
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'map': function(obj, map) {
      return objectMap(obj, map);
    },

    /***
     * @method some(search)
     * @returns Boolean
     * @short Returns true if `search` is true for any property in the object.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.some({a:1,b:2}, function(val) {
     *     return val == 1;
     *   }); -> true
     *   Object.some({a:1,b:2}, 1); -> true
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'some': objectSome,

    /***
     * @method every(search)
     * @returns Boolean
     * @short Returns true if `search` is true for all properties in the object.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.every({a:1,b:2}, function(val) {
     *     return val > 0;
     *   }); -> true
     *   Object.every({a:'a',b:'b'}, /[a-z]/); -> true
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'every': objectEvery,

    /***
     * @method filter(search)
     * @returns Array
     * @short Returns a new object with properties that match `search`.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.filter({a:1,b:2}, function(val) {
     *     return val == 1;
     *   }); -> {a:1}
     *   Object.filter({a:'a',z:'z'}, /[a-f]/); -> {a:'a'}
     *   Object.filter(usersByName, /^H/); -> all users with names starting with H
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'filter': function(obj, f) {
      return objectFilter(obj, f);
    },

    /***
     * @method reduce(reduceFn, [init])
     * @returns Mixed
     * @short Reduces the object to a single result.
     * @extra This operation is sometimes called "accumulation", as it takes the
     *        result of the last iteration of `fn` and passes it as the first
     *        argument to the next iteration, "accumulating" that value as it goes.
     *        The return value of this method will be the return value of the final
     *        iteration of `fn`. If [init] is passed, it will be the initial
     *        "accumulator" (the first argument). If [init] is not passed, then a
     *        property of the object will be used instead and `fn` will not be
     *        called for that property. Note that object properties have no order,
     *        and this may lead to bugs (for example if performing division or
     *        subtraction operations on a value). If order is important, use an
     *        array instead!
     *
     * @callback reduceFn
     *
     *   acc  The "accumulator", either [init], the result of the last iteration
     *        of `fn`, or a property of `obj`.
     *   val  The value of the current property called for `fn`.
     *   key  The key of the current property called for `fn`.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.reduce({a:2,b:4}, function(a, b) {
     *     return a * b;
     *   }); -> 8
     *
     *   Object.reduce({a:2,b:4}, function(a, b) {
     *     return a * b;
     *   }, 10); -> 80
     *
     *
     * @param {reduceFn} reduceFn
     * @param {any} [init]
     * @callbackParam {Property} acc
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     *
     ***/
    'reduce': function(obj, fn, init) {
      return objectReduce(obj, fn, init);
    },

    /***
     * @method find(search)
     * @returns Boolean
     * @short Returns the first key whose value matches `search`.
     * @extra Implements `enhanced matching`. Note that "first" is
     *        implementation-dependent. If order is important an array should be
     *        used instead.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.find({a:1,b:2}, function(val) {
     *     return val == 2;
     *   }); -> 'b'
     *   Object.find({a:'a',b:'b'}, /[a-z]/); -> 'a'
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'find': objectFind,

    /***
     * @method count(search)
     * @returns Number
     * @short Counts all properties in the object that match `search`.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.count({a:'a',b:'b',c:'a'}, 'a') -> 2
     *   Object.count(usersByName, function(user) {
     *     return user.age > 30;
     *   }); -> number of users older than 30
     *   Object.count(usersByName, { name: /^[H-Z]/ });
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'count': function(obj, f) {
      return objectCount(obj, f);
    },

    /***
     * @method none(search)
     * @returns Boolean
     * @short Returns true if none of the properties in the object match `search`.
     * @extra Implements `enhanced matching`.
     *
     * @callback searchFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.none({a:1,b:2}, 3); -> true
     *   Object.none(usersByName, function(user) {
     *     return user.name == 'Wolverine';
     *   }); -> probably true
     *
     * @param {Property|searchFn} search
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {boolean} searchFn
     *
     ***/
    'none': function(obj, f) {
      return objectNone(obj, f);
    },

    /***
     * @method sum([map])
     * @returns Number
     * @short Sums all properties in the object.
     * @extra [map] may be a function mapping the value to be summed or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.sum({a:35,b:13}); -> 48
     *   Object.sum(usersByName, function(user) {
     *     return user.votes;
     *   }); -> total user votes
     *
     * @param {string|mapFn} map
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'sum': function(obj, map) {
      return sum(obj, map);
    },

    /***
     * @method average([map])
     * @returns Number
     * @short Gets the mean average of all properties in the object.
     * @extra [map] may be a function mapping the value to be averaged or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.average({a:35,b:11}); -> 23
     *   Object.average(usersByName, 'age'); -> average user age
     *   Object.average(usersByName, 'currencies.usd.balance'); -> USD mean balance
     *
     * @param {string|mapFn} map
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'average': function(obj, map) {
      return average(obj, map);
    },

    /***
     * @method median([map])
     * @returns Number
     * @short Gets the median average of all properties in the object.
     * @extra [map] may be a function mapping the value to be averaged or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.median({a:1,b:2,c:2}) -> 2
     *   Object.median(usersByName, 'age'); -> median user age
     *   Object.median(usersByName, 'currencies.usd.balance'); -> USD median balance
     *
     * @param {string|mapFn} map
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'median': function(obj, map) {
      return median(obj, map);
    },

    /***
     * @method min([all] = false, [map])
     * @returns Mixed
     * @short Returns the key of the property in the object with the lowest value.
     * @extra If [all] is true, will return an object with all properties in the
     *        object with the lowest value. [map] may be passed in place of [all]
     *        and is a function mapping the value to be checked or a string acting
     *        as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.min({a:1,b:2,c:3})                    -> 'a'
     *   Object.min({a:'aaa',b:'bb',c:'c'}, 'length') -> 'c'
     *   Object.min({a:1,b:1,c:3}, true)              -> {a:1,b:1}
     *
     * @signature min([map])
     * @param {string|mapFn} map
     * @param {boolean} [all]
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'min': function(obj, all, map) {
      return getMinOrMax(obj, all, map, false, true);
    },

    /***
     * @method max([all] = false, [map])
     * @returns Mixed
     * @short Returns the key of the property in the object with the highest value.
     * @extra If [all] is true, will return an object with all properties in the
     *        object with the highest value. [map] may be passed in place of [all]
     *        and is a function mapping the value to be checked or a string acting
     *        as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.max({a:1,b:2,c:3})                    -> 'c'
     *   Object.max({a:'aaa',b:'bb',c:'c'}, 'length') -> 'a'
     *   Object.max({a:1,b:3,c:3}, true)              -> {b:3,c:3}
     *
     * @signature max([map])
     * @param {string|mapFn} map
     * @param {boolean} [all]
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'max': function(obj, all, map) {
      return getMinOrMax(obj, all, map, true, true);
    },

    /***
     * @method least([all] = false, [map])
     * @returns Mixed
     * @short Returns the key of the property in the object with the least commonly
     *        occuring value.
     * @extra If [all] is true, will return an object with all properties in the
     *        object with the least common value. [map] may be passed in place of
     *        [all] and is a function mapping the value to be checked or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.least({a:1,b:3,c:3})                   -> 'a'
     *   Object.least({a:'aa',b:'bb',c:'c'}, 'length') -> 'c'
     *   Object.least({a:1,b:3,c:3}, true)             -> {a:1}
     *
     * @signature least([map])
     * @param {string|mapFn} map
     * @param {boolean} [all]
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'least': function(obj, all, map) {
      return getLeastOrMost(obj, all, map, false, true);
    },

    /***
     * @method most([all] = false, [map])
     * @returns Mixed
     * @short Returns the key of the property in the object with the most commonly
     *        occuring value.
     * @extra If [all] is true, will return an object with all properties in the
     *        object with the most common value. [map] may be passed in place of
     *        [all] and is a function mapping the value to be checked or a string
     *        acting as a shortcut.
     *
     * @callback mapFn
     *
     *   val  The value of the current iteration.
     *   key  The key of the current iteration.
     *   obj  A reference to the object.
     *
     * @example
     *
     *   Object.most({a:1,b:3,c:3})                   -> 'b'
     *   Object.most({a:'aa',b:'bb',c:'c'}, 'length') -> 'a'
     *   Object.most({a:1,b:3,c:3}, true)             -> {b:3,c:3}
     *
     * @signature most([map])
     * @param {string|mapFn} map
     * @param {boolean} [all]
     * @callbackParam {Property} val
     * @callbackParam {string} key
     * @callbackParam {Object} obj
     * @callbackReturns {NewProperty} mapFn
     *
     ***/
    'most': function(obj, all, map) {
      return getLeastOrMost(obj, all, map, true, true);
    }

  });


  buildFromIndexMethods();

}).call(this);