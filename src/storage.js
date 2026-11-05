import { initialData, validateData } from "./model.js";
export const STORAGE_KEY = "pixelCalendar.v1";
export function createStore(storage) {
  const read = () => {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? initialData() : validateData(JSON.parse(raw));
    } catch (e) {
      throw Error(`無法讀取資料，請保留原資料：${e.message}`);
    }
  };
  function transaction(mutator, expectedRevision) {
    const previous = read();
    if (
      expectedRevision !== undefined &&
      previous.revision !== expectedRevision
    )
      throw Error("資料已在其他分頁更新，請取消並重新開啟這筆資料後再儲存");
    const next = structuredClone(previous);
    mutator(next);
    next.revision = previous.revision + 1;
    validateData(next);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw Error("儲存失敗，可能是空間不足或瀏覽器禁止儲存。輸入內容仍保留。");
    }
    return next;
  }
  return {
    read,
    transaction,
    replace(data) {
      validateData(data);
      return transaction((next) => {
        const revision = next.revision;
        Object.assign(next, structuredClone(data), { revision });
      });
    },
  };
}
