function responseError(status, responseText) {
  if (status === 401 || status === 403) {
    return new Error("انتهت صلاحية جلسة الإدارة أو لا توجد صلاحية لرفع هذا الملف.");
  }
  if (status === 413) return new Error("حجم الملف تجاوز الحد المسموح به في التخزين.");
  if (status === 429) return new Error("طلبات الرفع كثيرة الآن. انتظر قليلًا ثم أعد المحاولة.");
  if (status >= 500) return new Error("خدمة التخزين تواجه عطلًا مؤقتًا. أعد المحاولة لاحقًا.");

  let message = "";
  try {
    const body = JSON.parse(responseText);
    message = body.message || body.error || body.statusCode || "";
  } catch {
    message = "";
  }
  message = String(message)
    .replace(/\b(?:bearer|token|apikey|service.role)\b\s*[:=]?\s*\S+/gi, "بيانات اعتماد")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
  const error = new Error(message || `تعذر رفع الملف (HTTP ${status}).`);
  error.retryable = [408, 429, 500, 502, 503, 504].includes(status);
  return error;
}

function safeErrorMessage(error) {
  return String(error?.message || "تعذر رفع الملف.")
    .replace(/\b(?:bearer|token|apikey|service.role)\b\s*[:=]?\s*\S+/gi, "بيانات اعتماد")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 240);
}

export function uploadObjectWithXhr({
  supabaseUrl,
  bucket,
  objectPath,
  file,
  contentType,
  accessToken,
  anonKey,
  upsert = false,
  signal,
  onProgress = () => {},
}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const abort = () => {
      request.abort();
      finish(reject, new DOMException("تم إلغاء الرفع.", "AbortError"));
    };

    if (signal?.aborted) {
      finish(reject, new DOMException("تم إلغاء الرفع.", "AbortError"));
      return;
    }

    const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
    const url = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
    request.open("POST", url);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("apikey", anonKey);
    request.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    request.setRequestHeader("x-upsert", String(upsert));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) finish(resolve, objectPath);
      else finish(reject, responseError(request.status, request.responseText));
    });
    request.addEventListener("error", () => {
      const error = new Error("انقطع الاتصال أثناء الرفع. تحقق من الإنترنت ثم أعد المحاولة.");
      error.retryable = true;
      finish(reject, error);
    });
    request.addEventListener("timeout", () => {
      const error = new Error("انتهت مهلة رفع الملف. أعد المحاولة.");
      error.retryable = true;
      finish(reject, error);
    });
    request.addEventListener("abort", () => {
      finish(reject, new DOMException("تم إلغاء الرفع.", "AbortError"));
    });
    signal?.addEventListener("abort", abort, { once: true });
    request.send(file);
  });
}

export async function runUploadQueue(entries, uploadEntry, concurrency = 3, options = {}) {
  const { signal, onChange = () => {} } = options;
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < entries.length && !signal?.aborted) {
      const entry = entries[nextIndex++];
      entry.status = "uploading";
      entry.error = "";
      onChange(entry);
      try {
        await uploadEntry(entry);
        entry.status = "completed";
        entry.error = "";
      } catch (error) {
        entry.status = "failed";
        entry.error = safeErrorMessage(error);
      }
      onChange(entry);
    }
  };

  const workerCount = Math.min(entries.length, Math.max(1, Math.floor(concurrency)));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return entries;
}