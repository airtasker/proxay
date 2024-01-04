import { RewriteRule, RewriteRules } from "./rewrite";

const EXAMPLE_DOT_COM_UUID_RULE = new RewriteRule(
  /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(@example.com)$/gi,
  "$1",
);

describe("RewriteRule", () => {
  describe("without capture groups", () => {
    it("applies the expected changes", () => {
      const rule = new RewriteRule(/-[a-z0-9]+-?/gi, "");
      expect(rule.apply("")).toEqual("");
      expect(rule.apply("chicken")).toEqual("chicken");
      expect(rule.apply("one-TWO-thRee-fOUr")).toEqual("onethRee");
    });
  });

  describe("with capture groups", () => {
    it("applies the expected changes", () => {
      const rule1 = new RewriteRule(/\$([0-9]+)(\.[0-9]+)?/g, "£$1");
      expect(rule1.apply("")).toEqual("");
      expect(rule1.apply("chicken")).toEqual("chicken");
      expect(rule1.apply("They are $5, $7.90, and $1024.9876.")).toEqual(
        "They are £5, £7, and £1024.",
      );

      expect(
        EXAMPLE_DOT_COM_UUID_RULE.apply(
          "jane.doe-some-test-6f82fbbe-d36a-4c5c-b47b-84100122fbbc@example.com",
        ),
      ).toEqual("jane.doe-some-test@example.com");
      expect(
        EXAMPLE_DOT_COM_UUID_RULE.apply(
          "jane.doe-some-test-6F82FBBE-D36A-4C5C-B47B-84100122FBBC@example.com",
        ),
      ).toEqual("jane.doe-some-test@example.com");
    });
  });
});

describe("RewriteRules", () => {
  describe("when there are no rules", () => {
    const rules = new RewriteRules();

    it("does not mutate the given value at all", () => {
      expect(rules.apply("chicken")).toEqual("chicken");
    });
  });

  describe("when there is a simple rewrite rule", () => {
    const rules = new RewriteRules().appendRule(new RewriteRule(/dog/, "cat"));

    it("applies the expected changes on basic data types", () => {
      expect(rules.apply("The dog dodges the doggie.")).toEqual(
        "The cat dodges the doggie.",
      );
      expect(rules.apply(null)).toEqual(null);
      expect(rules.apply(undefined)).toEqual(undefined);
      expect(rules.apply(123.4)).toEqual(123.4);
      expect(rules.apply(true)).toEqual(true);
    });

    it("applies the expected changes on arrays", () => {
      const a1 = ["cat", "dog", "fish", "bird"];
      expect(rules.apply(a1)).toEqual(["cat", "cat", "fish", "bird"]);
      expect(a1).toEqual(["cat", "dog", "fish", "bird"]);
      expect(rules.apply([])).toEqual([]);
    });

    it("applies the expected changes on objects", () => {
      const o1 = { dog: "woof", doggie: "wuff", xyz: "I hate dogs" };
      expect(rules.apply(o1)).toEqual({
        cat: "woof",
        catgie: "wuff",
        xyz: "I hate cats",
      });
      expect(o1).toEqual({ dog: "woof", doggie: "wuff", xyz: "I hate dogs" });
      expect(rules.apply({})).toEqual({});
    });
  });

  describe("when there is a more complex rewrite rule", () => {
    const rules = new RewriteRules().appendRule(EXAMPLE_DOT_COM_UUID_RULE);

    it("applies the expected changes on objects", () => {
      const o2 = {
        "1": [
          "application-fake_user-070c625e-5f3a-4378-8641-eb3b38d5d800@example.com",
        ],
        "2": ["password.070c625e-5f3a-4378-8641-eb3b38d5d800"],
        "3": ["some value here"],
      };
      expect(rules.apply(o2)).toEqual({
        "1": ["application-fake_user@example.com"],
        "2": ["password.070c625e-5f3a-4378-8641-eb3b38d5d800"],
        "3": ["some value here"],
      });
    });
  });
});
