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
