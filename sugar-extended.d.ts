// Extended type definitions for Sugar v2.0.4
// Project: https://sugarjs.com/
// Definitions by: Andrew Plummer <plummer.andrew@gmail.com>

/// <reference path="sugar.d.ts" />

interface Array<T> {
  average(map?: string|sugarjs.Array.mapFn): number;
  count(search: T|sugarjs.Array.searchFn, context?: any): number;
  every(search: T|sugarjs.Array.searchFn, context?: any): boolean;
  everyFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  everyFromIndex(startIndex: number, ...args: any[]): T;
  filter(search: T|sugarjs.Array.searchFn, context?: any): T[];
  filterFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  filterFromIndex(startIndex: number, ...args: any[]): T;
  find(search: T|sugarjs.Array.searchFn, context?: any): T;
  findFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  findFromIndex(startIndex: number, ...args: any[]): T;
  findIndex(search: T|sugarjs.Array.searchFn, context?: any): number;
  findIndexFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  findIndexFromIndex(startIndex: number, ...args: any[]): T;
  forEachFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  forEachFromIndex(startIndex: number, ...args: any[]): T;
  least(all?: boolean, map?: string|sugarjs.Array.mapFn): T[];
  least(map?: string|sugarjs.Array.mapFn): T[];
  map<U>(map: string|sugarjs.Array.mapFn, context?: any): U[];
  mapFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  mapFromIndex(startIndex: number, ...args: any[]): T;
  max(all?: boolean, map?: string|sugarjs.Array.mapFn): T;
  max(map?: string|sugarjs.Array.mapFn): T;
  median(map?: string|sugarjs.Array.mapFn): number;
  min(all?: boolean, map?: string|sugarjs.Array.mapFn): T;
  min(map?: string|sugarjs.Array.mapFn): T;
  most(all?: boolean, map?: string|sugarjs.Array.mapFn): T[];
  most(map?: string|sugarjs.Array.mapFn): T[];
  none(search: T|sugarjs.Array.searchFn, context?: any): boolean;
  reduceFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  reduceFromIndex(startIndex: number, ...args: any[]): T;
  reduceRightFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  reduceRightFromIndex(startIndex: number, ...args: any[]): T;
  some(search: T|sugarjs.Array.searchFn, context?: any): boolean;
  someFromIndex(startIndex: number, loop?: boolean, ...args: any[]): T;
  someFromIndex(startIndex: number, ...args: any[]): T;
  sum(map?: string|sugarjs.Array.mapFn): number;
}

interface ObjectConstructor {
  average(instance: Object, map?: string|sugarjs.Object.mapFn): number;
  count<T>(instance: Object, search: T|sugarjs.Object.searchFn): number;
  every<T>(instance: Object, search: T|sugarjs.Object.searchFn): boolean;
  filter<T>(instance: Object, search: T|sugarjs.Object.searchFn): T[];
  find<T>(instance: Object, search: T|sugarjs.Object.searchFn): boolean;
  forEach<T>(instance: Object, fn: (val: T, key: string, obj: Object) => void): Object;
  least<T>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn): T;
  least<T>(instance: Object, map?: string|sugarjs.Object.mapFn): T;
  map<T, U>(instance: Object, map: string|sugarjs.Object.mapFn): Object;
  max<T>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn): T;
  max<T>(instance: Object, map?: string|sugarjs.Object.mapFn): T;
  median(instance: Object, map?: string|sugarjs.Object.mapFn): number;
  min<T>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn): T;
  min<T>(instance: Object, map?: string|sugarjs.Object.mapFn): T;
  most<T>(instance: Object, all?: boolean, map?: string|sugarjs.Object.mapFn): T;
  most<T>(instance: Object, map?: string|sugarjs.Object.mapFn): T;
  none<T>(instance: Object, search: T|sugarjs.Object.searchFn): boolean;
  reduce<T>(instance: Object, reduceFn: (acc: T, val: T, key: string, obj: Object) => void, init?: any): T;
  some<T>(instance: Object, search: T|sugarjs.Object.searchFn): boolean;
  sum(instance: Object, map?: string|sugarjs.Object.mapFn): number;
}