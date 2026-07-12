import { z } from "zod";

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN은 숫자 4자리여야 합니다.");

export const deliveryTypeSchema = z.enum(["ambient", "fresh"]);

export const createItemSchema = z.object({
  inputValue: z.string().trim().min(1, "품목을 입력해주세요.").max(2048),
  quantity: z.coerce.number().int().min(1).max(999),
  deliveryType: deliveryTypeSchema,
});

export const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  deliveryType: deliveryTypeSchema.optional(),
});

export function parseItemInput(inputValue: string) {
  const value = inputValue.trim();
  let url: URL | null = null;

  try {
    url = new URL(value);
  } catch {
    // 일반 품목명은 URL 파싱에 실패하는 것이 정상이다.
  }

  if (url?.protocol === "http:" || url?.protocol === "https:") {
    return {
      inputType: "url" as const,
      itemName: "와이즐리 상품",
      productUrl: value,
    };
  }

  if (value.length > 100) {
    throw new Error("제품명은 100자 이하여야 합니다.");
  }

  return { inputType: "text" as const, itemName: value, productUrl: null };
}
