import { describe, expect, it } from "vitest";
import { createItemSchema, parseItemInput, pinSchema } from "./validation";

describe("PIN validation", () => {
  it("accepts exactly four digits", () => {
    expect(pinSchema.safeParse("0427").success).toBe(true);
  });

  it.each(["123", "12345", "12a4", ""])('rejects "%s"', (value) => {
    expect(pinSchema.safeParse(value).success).toBe(false);
  });
});

describe("cart item validation", () => {
  it("trims a text item", () => {
    expect(parseItemInput("  면도날  ")).toEqual({ inputType: "text", itemName: "면도날", productUrl: null });
  });

  it("keeps an https URL", () => {
    expect(parseItemInput("https://www.wiselycompany.com/product/1")).toEqual({
      inputType: "url", itemName: "와이즐리 상품", productUrl: "https://www.wiselycompany.com/product/1",
    });
  });

  it("rejects quantity below one", () => {
    expect(createItemSchema.safeParse({ inputValue: "세제", quantity: 0, deliveryType: "ambient" }).success).toBe(false);
  });
});
