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

  appendRule(rule: RewriteRule) {
    this.rules.push(rule);
  }

  apply<T>(value: T): T {
    if (typeof value === "object" && value !== null) {
      // If the object is an array, iterate through each element and call the function recursively
      if (Array.isArray(value)) {
        return (value.map((v) => this.apply(v)) as any) as T;
      }

      // If the object is not an array, create a new object with the same keys,
      // and call the function recursively on each value
      const oldObj = value as { [key: string]: any };
      const newObj: { [key: string]: any } = {};
      for (const key of Object.keys(oldObj)) {
        newObj[key] = this.apply(oldObj[key]);
      }
      return newObj as T;
    } else if (typeof value === "string") {
      let s = value as string;
      for (const rule of this.rules) {
        s = rule.apply(value);
      }
      return (s as any) as T;
    } else {
      return value;
    }
  }
}
