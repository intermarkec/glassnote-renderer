// Simple Map polyfill for older browsers
if (typeof Map === 'undefined') {
  class SimpleMap {
    private keys: any[] = []
    private values: any[] = []

    set(key: any, value: any): this {
      const index = this.keys.indexOf(key)
      if (index === -1) {
        this.keys.push(key)
        this.values.push(value)
      } else {
        this.values[index] = value
      }
      return this
    }

    get(key: any): any {
      const index = this.keys.indexOf(key)
      return index === -1 ? undefined : this.values[index]
    }

    has(key: any): boolean {
      return this.keys.indexOf(key) !== -1
    }

    delete(key: any): boolean {
      const index = this.keys.indexOf(key)
      if (index !== -1) {
        this.keys.splice(index, 1)
        this.values.splice(index, 1)
      }
      return index !== -1
    }

    get size(): number {
      return this.keys.length
    }
  }

  window.Map = SimpleMap as any
}

// Polyfill for Array.from if not available
if (typeof Array.from !== 'function') {
  Array.from = (function () {
    const toStr = Object.prototype.toString
    const isCallable = function (fn: any): boolean {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]'
    }
    const toInteger = function (value: any): number {
      const number = Number(value)
      if (isNaN(number)) { return 0 }
      if (number === 0 || !isFinite(number)) { return number }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number))
    }
    const maxSafeInteger = Math.pow(2, 53) - 1
    const toLength = function (value: any): number {
      const len = toInteger(value)
      return Math.min(Math.max(len, 0), maxSafeInteger)
    }

    return function from<T>(arrayLike: ArrayLike<T>, mapFn?: (value: T, index: number) => any, thisArg?: any): any[] {
      // 1. Let C be the this value.
      const C = this as any

      // 2. Let items be ToObject(arrayLike).
      const items = Object(arrayLike)

      // 3. ReturnIfAbrupt(items).
      if (arrayLike == null) {
        throw new TypeError('Array.from requires an array-like object - not null or undefined')
      }

      // 4. If mapFn is undefined, then let mapping be false.
      let T: any
      if (typeof mapFn !== 'undefined') {
        // 5. else
        // 5. a If IsCallable(mapFn) is false, throw a TypeError exception.
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function')
        }

        // 5. b. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 2) {
          T = arguments[2]
        }
      }

      // 6. Let len be ToLength(Get(items, "length")).
      const len = toLength(items.length)

      // 7. Let A be IsConstructor(C) ? Object(new C(len)) : new Array(len).
      const A = isCallable(C) ? Object(new C(len)) : new Array(len)

      // 8. Let k be 0.
      let k = 0
      // 9. Repeat, while k < len
      while (k < len) {
        // 9. a. Let Pk be ToString(k).
        // 9. b. Let kValue be Get(items, Pk).
        // 9. c. Let mappedValue be mapping ? Call(mapFn, T, «kValue, k») : kValue.
        // 9. d. Perform CreateDataPropertyOrThrow(A, Pk, mappedValue).
        // 9. e. Increase k by 1.
        let kValue: T
        if (k in items) {
          kValue = items[k]
          if (mapFn) {
            A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k)
          } else {
            A[k] = kValue
          }
        }
        k++
      }
      // 10. Let putStatus be Put(A, "length", len, true).
      A.length = len
      // 11. Return A.
      return A
    }
  })()
}

// Polyfill for Array.prototype.find if not available
if (!Array.prototype.find) {
  Array.prototype.find = function<T>(predicate: (value: T, index: number, obj: T[]) => boolean, thisArg?: any): T | undefined {
    if (this == null) {
      throw new TypeError('Array.prototype.find called on null or undefined')
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function')
    }
    const list = Object(this) as T[]
    const length = list.length >>> 0
    let value: T

    for (let i = 0; i < length; i++) {
      value = list[i]
      if (predicate.call(thisArg, value, i, list)) {
        return value
      }
    }
    return undefined
  }
}

// Polyfill for Array.prototype.findIndex if not available
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function<T>(predicate: (value: T, index: number, obj: T[]) => boolean, thisArg?: any): number {
    if (this == null) {
      throw new TypeError('Array.prototype.findIndex called on null or undefined')
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function')
    }
    const list = Object(this) as T[]
    const length = list.length >>> 0
    let value: T

    for (let i = 0; i < length; i++) {
      value = list[i]
      if (predicate.call(thisArg, value, i, list)) {
        return i
      }
    }
    return -1
  }
}

// Polyfill for Array.prototype.some if not available
if (!Array.prototype.some) {
  Array.prototype.some = function<T>(predicate: (value: T, index: number, array: T[]) => boolean, thisArg?: any): boolean {
    if (this == null) {
      throw new TypeError('Array.prototype.some called on null or undefined')
    }

    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function')
    }

    const t = Object(this) as T[]
    const len = t.length >>> 0

    for (let i = 0; i < len; i++) {
      if (i in t && predicate.call(thisArg, t[i], i, t)) {
        return true
      }
    }

    return false
  }
}

// Polyfill for Map.prototype.forEach if not available
if (typeof Map !== 'undefined' && !Map.prototype.forEach) {
  Map.prototype.forEach = function<T>(callback: (value: T, key: any, map: Map<any, T>) => void, thisArg?: any): void {
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function')
    }
    const entries = this.entries()
    let entry: IteratorResult<[any, T]>
    while (!(entry = entries.next()).done) {
      const keyValue = entry.value
      callback.call(thisArg, keyValue[1], keyValue[0], this)
    }
  }
}

// Add compatibility initialization
(function() {
  // Ensure all polyfills are loaded before other scripts
  if (typeof window.compatibilityLoaded === 'undefined') {
    window.compatibilityLoaded = true
  }
})()