// Type definitions for Sugar v2.0.2
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

declare module sugarjs {

  type DisambiguationFunction = Function;
  type SugarDefaultChainable<RawValue> = Array.Chainable<any, RawValue> &
                                         Date.Chainable<RawValue> &
                                         Function.Chainable<RawValue> &
                                         Number.Chainable<RawValue> &
                                         Object.Chainable<RawValue> &
                                         RegExp.Chainable<RawValue> &
                                         String.Chainable<RawValue>;
  type NativeConstructor = ArrayConstructor |
                           DateConstructor |
                           FunctionConstructor |
                           NumberConstructor |
                           ObjectConstructor |
                           RegExpConstructor |
                           StringConstructor |
                           BooleanConstructor |
                           ErrorConstructor;

  interface ExtendOptions {
    methods?: Array<string>;
    except?: Array<string|NativeConstructor>;
    namespaces?: Array<NativeConstructor>;
    enhance?: boolean;
    enhanceString?: boolean;
    enhanceArray?: boolean;
    objectPrototype?: boolean;
  }

  interface Sugar {
    (opts?: ExtendOptions): Sugar;
    createNamespace(name: string): SugarNamespace;
    extend(opts?: ExtendOptions): Sugar;
    Array: Array.Constructor;
    Date: Date.Constructor;
    Function: Function.Constructor;
    Number: Number.Constructor;
    Object: Object.Constructor;
    RegExp: RegExp.Constructor;
    String: String.Constructor;
  }

  interface SugarNamespace {
    alias(toName: string, from: string|Function): this;
    alias(toName: string, fn: undefined): this;
    defineInstance(methods: Object): this;
    defineInstance(methodName: string, methodFn: Function): this;
    defineInstanceAndStatic(methods: Object): this;
    defineInstanceAndStatic(methodName: string, methodFn: Function): this;
    defineInstancePolyfill(methods: Object): this;
    defineInstancePolyfill(methodName: string, methodFn: Function): this;
    defineInstanceWithArguments(methods: Object): this;
    defineInstanceWithArguments(methodName: string, methodFn: Function): this;
    defineStatic(methods: Object): this;
    defineStatic(methodName: string, methodFn: Function): this;
    defineStaticPolyfill(methods: Object): this;
    defineStaticPolyfill(methodName: string, methodFn: Function): this;
    defineStaticWithArguments(methods: Object): this;
    defineStaticWithArguments(methodName: string, methodFn: Function): this;
    extend(opts?: ExtendOptions): this;
  }

  module Array {

    type Chainable<T, RawValue> = ChainableBase<T, RawValue> & Object.ChainableBase<RawValue>;
    type mapFn = <T, U>(el: T, i: number, arr: T[]) => U;
    type searchFn = <T>(el: T, i: number, arr: T[]) => boolean;

    interface Constructor extends SugarNamespace {
      average<T>(instance: T[], map?: string|mapFn): number;
      count<T>(instance: T[], search: T|searchFn, context?: any): number;
      every<T>(instance: T[], search: T|searchFn, context?: any): boolean;
      everyFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      everyFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      filter<T>(instance: T[], search: T|searchFn, context?: any): T[];
      filterFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      filterFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      find<T>(instance: T[], search: T|searchFn, context?: any): T;
      findFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      findFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      findIndex<T>(instance: T[], search: T|searchFn, context?: any): number;
      findIndexFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      findIndexFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      forEachFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      forEachFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      least<T>(instance: T[], all?: boolean, map?: string|mapFn): T[];
      least<T>(instance: T[], map?: string|mapFn): T[];
      map<T, U>(instance: T[], map: string|mapFn, context?: any): U[];
      mapFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      mapFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      max<T>(instance: T[], all?: boolean, map?: string|mapFn): T;
      max<T>(instance: T[], map?: string|mapFn): T;
      median<T>(instance: T[], map?: string|mapFn): number;
      min<T>(instance: T[], all?: boolean, map?: string|mapFn): T;
      min<T>(instance: T[], map?: string|mapFn): T;
      most<T>(instance: T[], all?: boolean, map?: string|mapFn): T[];
      most<T>(instance: T[], map?: string|mapFn): T[];
      none<T>(instance: T[], search: T|searchFn, context?: any): boolean;
      reduceFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      reduceFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      reduceRightFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      reduceRightFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      some<T>(instance: T[], search: T|searchFn, context?: any): boolean;
      someFromIndex<T>(instance: T[], startIndex: number, loop?: boolean, ...args: any[]): T;
      someFromIndex<T>(instance: T[], startIndex: number, ...args: any[]): T;
      sum<T>(instance: T[], map?: string|mapFn): number;
    }

    interface ChainableBase<T, RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      average(map?: string|mapFn): SugarDefaultChainable<number>;
      count(search: T|searchFn, context?: any): SugarDefaultChainable<number>;
      every(search: T|searchFn, context?: any): SugarDefaultChainable<boolean>;
      everyFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      everyFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      filter(search: T|searchFn, context?: any): SugarDefaultChainable<T[]>;
      filterFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      filterFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      find(search: T|searchFn, context?: any): SugarDefaultChainable<T>;
      findFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      findFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      findIndex(search: T|searchFn, context?: any): SugarDefaultChainable<number>;
      findIndexFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      findIndexFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      forEachFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      forEachFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      least(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T[]>;
      least(map?: string|mapFn): SugarDefaultChainable<T[]>;
      map<U>(map: string|mapFn, context?: any): SugarDefaultChainable<U[]>;
      mapFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      mapFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      max(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      max(map?: string|mapFn): SugarDefaultChainable<T>;
      median(map?: string|mapFn): SugarDefaultChainable<number>;
      min(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      min(map?: string|mapFn): SugarDefaultChainable<T>;
      most(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T[]>;
      most(map?: string|mapFn): SugarDefaultChainable<T[]>;
      none(search: T|searchFn, context?: any): SugarDefaultChainable<boolean>;
      reduceFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      reduceFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      reduceRightFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      reduceRightFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      some(search: T|searchFn, context?: any): SugarDefaultChainable<boolean>;
      someFromIndex(startIndex: number, loop?: boolean, ...args: any[]): SugarDefaultChainable<T>;
      someFromIndex(startIndex: number, ...args: any[]): SugarDefaultChainable<T>;
      sum(map?: string|mapFn): SugarDefaultChainable<number>;
      concat(...items: (T | T[])[]): SugarDefaultChainable<T[]>;
      concat(...items: T[][]): SugarDefaultChainable<T[]>;
      copyWithin(target: number, start: number, end?: number): SugarDefaultChainable<this>;
      every(callbackfn: (value: T, index: number, array: T[]) => boolean, thisArg?: any): SugarDefaultChainable<boolean>;
      fill(value: T, start?: number, end?: number): SugarDefaultChainable<this>;
      filter(callbackfn: (value: T, index: number, array: T[]) => any, thisArg?: any): SugarDefaultChainable<T[]>;
      find(predicate: (value: T, index: number, obj: Array<T>) => boolean, thisArg?: any): SugarDefaultChainable<T | undefined>;
      findIndex(predicate: (value: T, index: number, obj: Array<T>) => boolean, thisArg?: any): SugarDefaultChainable<number>;
      forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): SugarDefaultChainable<void>;
      indexOf(searchElement: T, fromIndex?: number): SugarDefaultChainable<number>;
      join(separator?: string): SugarDefaultChainable<string>;
      lastIndexOf(searchElement: T, fromIndex?: number): SugarDefaultChainable<number>;
      map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): SugarDefaultChainable<U[]>;
      pop(): SugarDefaultChainable<T | undefined>;
      push(...items: T[]): SugarDefaultChainable<number>;
      reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): SugarDefaultChainable<T>;
      reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): SugarDefaultChainable<U>;
      reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue?: T): SugarDefaultChainable<T>;
      reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): SugarDefaultChainable<U>;
      reverse(): SugarDefaultChainable<T[]>;
      shift(): SugarDefaultChainable<T | undefined>;
      slice(start?: number, end?: number): SugarDefaultChainable<T[]>;
      some(callbackfn: (value: T, index: number, array: T[]) => boolean, thisArg?: any): SugarDefaultChainable<boolean>;
      sort(compareFn?: (a: T, b: T) => number): SugarDefaultChainable<this>;
      splice(start: number): SugarDefaultChainable<T[]>;
      splice(start: number, deleteCount: number, ...items: T[]): SugarDefaultChainable<T[]>;
      toLocaleString(): SugarDefaultChainable<string>;
      unshift(...items: T[]): SugarDefaultChainable<number>;
    }

  }

  module Date {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      getDate(): SugarDefaultChainable<number>;
      getDay(): SugarDefaultChainable<number>;
      getFullYear(): SugarDefaultChainable<number>;
      getHours(): SugarDefaultChainable<number>;
      getMilliseconds(): SugarDefaultChainable<number>;
      getMinutes(): SugarDefaultChainable<number>;
      getMonth(): SugarDefaultChainable<number>;
      getSeconds(): SugarDefaultChainable<number>;
      getTime(): SugarDefaultChainable<number>;
      getTimezoneOffset(): SugarDefaultChainable<number>;
      getUTCDate(): SugarDefaultChainable<number>;
      getUTCDay(): SugarDefaultChainable<number>;
      getUTCFullYear(): SugarDefaultChainable<number>;
      getUTCHours(): SugarDefaultChainable<number>;
      getUTCMilliseconds(): SugarDefaultChainable<number>;
      getUTCMinutes(): SugarDefaultChainable<number>;
      getUTCMonth(): SugarDefaultChainable<number>;
      getUTCSeconds(): SugarDefaultChainable<number>;
      setDate(date: number): SugarDefaultChainable<number>;
      setFullYear(year: number, month?: number, date?: number): SugarDefaultChainable<number>;
      setHours(hours: number, min?: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setMilliseconds(ms: number): SugarDefaultChainable<number>;
      setMinutes(min: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setMonth(month: number, date?: number): SugarDefaultChainable<number>;
      setSeconds(sec: number, ms?: number): SugarDefaultChainable<number>;
      setTime(time: number): SugarDefaultChainable<number>;
      setUTCDate(date: number): SugarDefaultChainable<number>;
      setUTCFullYear(year: number, month?: number, date?: number): SugarDefaultChainable<number>;
      setUTCHours(hours: number, min?: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setUTCMilliseconds(ms: number): SugarDefaultChainable<number>;
      setUTCMinutes(min: number, sec?: number, ms?: number): SugarDefaultChainable<number>;
      setUTCMonth(month: number, date?: number): SugarDefaultChainable<number>;
      setUTCSeconds(sec: number, ms?: number): SugarDefaultChainable<number>;
      toDateString(): SugarDefaultChainable<string>;
      toISOString(): SugarDefaultChainable<string>;
      toJSON(key?: any): SugarDefaultChainable<string>;
      toLocaleDateString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toLocaleDateString(): SugarDefaultChainable<string>;
      toLocaleString(): SugarDefaultChainable<string>;
      toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toLocaleTimeString(): SugarDefaultChainable<string>;
      toLocaleTimeString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): SugarDefaultChainable<string>;
      toTimeString(): SugarDefaultChainable<string>;
      toUTCString(): SugarDefaultChainable<string>;
    }

  }

  module Function {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      apply(thisArg: any, argArray?: any): SugarDefaultChainable<any>;
      bind(thisArg: any, ...argArray: any[]): SugarDefaultChainable<any>;
      call(thisArg: any, ...argArray: any[]): SugarDefaultChainable<any>;
    }

  }

  module Number {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      toExponential(fractionDigits?: number): SugarDefaultChainable<string>;
      toFixed(fractionDigits?: number): SugarDefaultChainable<string>;
      toLocaleString(locales?: string | string[], options?: Intl.NumberFormatOptions): SugarDefaultChainable<string>;
      toPrecision(precision?: number): SugarDefaultChainable<string>;
    }

  }

  module Object {

    type Chainable<RawValue> = ChainableBase<RawValue>;
    type mapFn = <T, U>(val: T, key: string, obj: Object) => U;
    type searchFn = <T>(val: T, key: string, obj: Object) => boolean;

    interface Constructor extends SugarNamespace {
      average(instance: Object, map?: string|mapFn): number;
      count<T>(instance: Object, search: T|searchFn): number;
      every<T>(instance: Object, search: T|searchFn): boolean;
      filter<T>(instance: Object, search: T|searchFn): T[];
      find<T>(instance: Object, search: T|searchFn): boolean;
      forEach<T>(instance: Object, fn: (val: T, key: string, obj: Object) => void): Object;
      least<T>(instance: Object, all?: boolean, map?: string|mapFn): T;
      least<T>(instance: Object, map?: string|mapFn): T;
      map(instance: Object, map: string|mapFn): Object;
      max<T>(instance: Object, all?: boolean, map?: string|mapFn): T;
      max<T>(instance: Object, map?: string|mapFn): T;
      median(instance: Object, map?: string|mapFn): number;
      min<T>(instance: Object, all?: boolean, map?: string|mapFn): T;
      min<T>(instance: Object, map?: string|mapFn): T;
      most<T>(instance: Object, all?: boolean, map?: string|mapFn): T;
      most<T>(instance: Object, map?: string|mapFn): T;
      none<T>(instance: Object, search: T|searchFn): boolean;
      reduce<T>(instance: Object, reduceFn: (acc: T, val: T, key: string, obj: Object) => void, init?: any): T;
      some<T>(instance: Object, search: T|searchFn): boolean;
      sum(instance: Object, map?: string|mapFn): number;
    }

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      average(map?: string|mapFn): SugarDefaultChainable<number>;
      count<T>(search: T|searchFn): SugarDefaultChainable<number>;
      every<T>(search: T|searchFn): SugarDefaultChainable<boolean>;
      filter<T>(search: T|searchFn): SugarDefaultChainable<T[]>;
      find<T>(search: T|searchFn): SugarDefaultChainable<boolean>;
      forEach<T>(fn: (val: T, key: string, obj: Object) => SugarDefaultChainable<void>): SugarDefaultChainable<Object>;
      least<T>(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      least<T>(map?: string|mapFn): SugarDefaultChainable<T>;
      map(map: string|mapFn): SugarDefaultChainable<Object>;
      max<T>(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      max<T>(map?: string|mapFn): SugarDefaultChainable<T>;
      median(map?: string|mapFn): SugarDefaultChainable<number>;
      min<T>(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      min<T>(map?: string|mapFn): SugarDefaultChainable<T>;
      most<T>(all?: boolean, map?: string|mapFn): SugarDefaultChainable<T>;
      most<T>(map?: string|mapFn): SugarDefaultChainable<T>;
      none<T>(search: T|searchFn): SugarDefaultChainable<boolean>;
      reduce<T>(reduceFn: (acc: T, val: T, key: string, obj: Object) => SugarDefaultChainable<void>, init?: any): SugarDefaultChainable<T>;
      some<T>(search: T|searchFn): SugarDefaultChainable<boolean>;
      sum(map?: string|mapFn): SugarDefaultChainable<number>;
    }

  }

  module RegExp {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      exec(string: string): SugarDefaultChainable<RegExpExecArray | null>;
      test(string: string): SugarDefaultChainable<boolean>;
    }

  }

  module String {

    type Chainable<RawValue> = ChainableBase<RawValue> & Object.ChainableBase<RawValue>;

    interface ChainableBase<RawValue> {
      raw: RawValue;
      valueOf: () => RawValue;
      toString: () => string;
      anchor(name: string): SugarDefaultChainable<string>;
      big(): SugarDefaultChainable<string>;
      blink(): SugarDefaultChainable<string>;
      bold(): SugarDefaultChainable<string>;
      charAt(pos: number): SugarDefaultChainable<string>;
      charCodeAt(index: number): SugarDefaultChainable<number>;
      codePointAt(pos: number): SugarDefaultChainable<number | undefined>;
      concat(...strings: string[]): SugarDefaultChainable<string>;
      endsWith(searchString: string, endPosition?: number): SugarDefaultChainable<boolean>;
      fixed(): SugarDefaultChainable<string>;
      fontcolor(color: string): SugarDefaultChainable<string>;
      fontsize(size: number): SugarDefaultChainable<string>;
      fontsize(size: string): SugarDefaultChainable<string>;
      includes(searchString: string, position?: number): SugarDefaultChainable<boolean>;
      indexOf(searchString: string, position?: number): SugarDefaultChainable<number>;
      italics(): SugarDefaultChainable<string>;
      lastIndexOf(searchString: string, position?: number): SugarDefaultChainable<number>;
      link(url: string): SugarDefaultChainable<string>;
      localeCompare(that: string): SugarDefaultChainable<number>;
      localeCompare(that: string, locales?: string | string[], options?: Intl.CollatorOptions): SugarDefaultChainable<number>;
      match(regexp: RegExp): SugarDefaultChainable<RegExpMatchArray | null>;
      match(regexp: string): SugarDefaultChainable<RegExpMatchArray | null>;
      normalize(form?: string): SugarDefaultChainable<string>;
      normalize(form: "NFC" | "NFD" | "NFKC" | "NFKD"): SugarDefaultChainable<string>;
      repeat(count: number): SugarDefaultChainable<string>;
      replace(searchValue: string, replaceValue: string): SugarDefaultChainable<string>;
      replace(searchValue: string, replacer: (substring: string, ...args: any[]) => string): SugarDefaultChainable<string>;
      replace(searchValue: RegExp, replaceValue: string): SugarDefaultChainable<string>;
      replace(searchValue: RegExp, replacer: (substring: string, ...args: any[]) => string): SugarDefaultChainable<string>;
      search(regexp: RegExp): SugarDefaultChainable<number>;
      search(regexp: string): SugarDefaultChainable<number>;
      slice(start?: number, end?: number): SugarDefaultChainable<string>;
      small(): SugarDefaultChainable<string>;
      split(separator: string, limit?: number): SugarDefaultChainable<string[]>;
      split(separator: RegExp, limit?: number): SugarDefaultChainable<string[]>;
      startsWith(searchString: string, position?: number): SugarDefaultChainable<boolean>;
      strike(): SugarDefaultChainable<string>;
      sub(): SugarDefaultChainable<string>;
      substr(from: number, length?: number): SugarDefaultChainable<string>;
      substring(start: number, end?: number): SugarDefaultChainable<string>;
      sup(): SugarDefaultChainable<string>;
      toLocaleLowerCase(): SugarDefaultChainable<string>;
      toLocaleUpperCase(): SugarDefaultChainable<string>;
      toLowerCase(): SugarDefaultChainable<string>;
      toUpperCase(): SugarDefaultChainable<string>;
      trim(): SugarDefaultChainable<string>;
    }

  }

}

declare var Sugar: sugarjs.Sugar;