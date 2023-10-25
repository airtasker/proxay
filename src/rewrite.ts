export class RewriteRule {
  find: RegExp;
  replace: string;

  constructor(find: RegExp, replace: string) {
    this.find = find;
    this.replace = replace;
  }

  apply(value: string): string {
    return value.replace(this.find, this.replace);
  }
}

export class RewriteRules {
  private rules: RewriteRule[];

  constructor() {
    this.rules = [];
  }

  appendRule(rule: RewriteRule): RewriteRules {
    this.rules.push(rule);
    return this;
  }

  apply<T>(value: T): T {
    // Bail early if we have no rules to apply.
    if (this.rules.length === 0) {
      return value;
    }

    return this._apply(value);
  }

  private _apply<T>(value: T): T {
    if (typeof value === "object" && value !== null) {
      // If the object is an array, iterate through each element and call the function recursively
      if (Array.isArray(value)) {
        return value.map((v) => this._apply(v)) as any as T;
      }

      // If the object is not an array, create a new object with the same keys,
      // and call the function recursively on each value
      const oldObj = value as { [key: string]: any };
      const newObj: { [key: string]: any } = {};
      for (const key of Object.keys(oldObj)) {
        const newKey = this._apply(key);
        const newValue = this._apply(oldObj[key]);
        newObj[newKey] = newValue;
      }
      return newObj as T;
    } else if (typeof value === "string") {
      let s = value as string;
      for (const rule of this.rules) {
        s = rule.apply(value);
      }
      return s as any as T;
    } else {
      return value;
    }
  }
}
