/** Internal, used only by components under src/components. Joins truthy class names. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}
