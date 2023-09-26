import { RewriteRule, RewriteRules } from "./rewrite";

describe("RewriteRule", () => {
  describe("without capture groups", () => {
    it("applies the expected changes", () => {
      const rule = new RewriteRule(/-[a-z0-9]+-?/gi, '');
      expect(rule.apply('')).toEqual('');
      expect(rule.apply('chicken')).toEqual('chicken');
      expect(rule.apply('one-TWO-thRee-fOUr')).toEqual('onethRee');
    });
  })

  describe("with capture groups", () => {
    it("applies the expected changes", () => {
      const rule = new RewriteRule(/\$([0-9]+)(\.[0-9]+)?/g, '£$1');
      expect(rule.apply('')).toEqual('');
      expect(rule.apply('chicken')).toEqual('chicken');
      expect(rule.apply('They are $5, $7.90, and $1024.9876.')).toEqual('They are £5, £7, and £1024.');
    });
  });
});

describe("RewriteRules", () => {
  describe("when there are no rules", () => {
    const rules = new RewriteRules();

    it("does not mutate the given value at all", () => {
      expect(rules.apply("chicken")).toEqual("chicken")
    })
  })

  describe("when there is a simple rewrite rule", () => {
    const rules = new RewriteRules()
        .appendRule(new RewriteRule(/dog/, 'cat'));

    it("applies the expected changes on basic data types", () => {
      expect(rules.apply("The dog dodges the doggie.")).toEqual("The cat dodges the doggie.")
      expect(rules.apply(null)).toEqual(null)
      expect(rules.apply(undefined)).toEqual(undefined)
      expect(rules.apply(123.4)).toEqual(123.4)
      expect(rules.apply(true)).toEqual(true)
    })

    it("applies the expected changes on arrays", () => {
      const a1 = ['cat', 'dog', 'fish', 'bird'];
      expect(rules.apply(a1)).toEqual(['cat', 'cat', 'fish', 'bird']);
      expect(a1).toEqual(['cat', 'dog', 'fish', 'bird']);
      expect(rules.apply([])).toEqual([])
    })
  })
});