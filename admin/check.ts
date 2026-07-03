import { ConvexClient } from "convex/browser";
const client = new ConvexClient("http://localhost");
client.setAuth(async () => "foo", (onChange) => {
  onChange();
  return () => {};
});
