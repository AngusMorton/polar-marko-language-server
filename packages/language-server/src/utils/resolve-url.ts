export default function resolveUrl(to: string, base: string) {
  try {
    const url = new URL(to, base);
    console.log("Resolved URL", to, base, " as ", url.toString());

    if (url.protocol === "file:") return url.toString();
  } catch (ex) {
    console.error(ex);
    return undefined;
  }
}
