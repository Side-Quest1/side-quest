import qr from "qrcode-generator";

export function activityCode(url: string) {
  const code = qr(0, "M");
  code.addData(url);
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => code.isDark(y, x)),
  );
}
