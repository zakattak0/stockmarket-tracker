export type Quote = {
  price: number;
  ts: number;
  source: "stream" | "quote";
  prevClose?: number | null;
};
