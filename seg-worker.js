// 불똥이 인식 AI를 화면 그리기와 따로 돌리는 작업 공간 (AI가 계산하는 동안에도 화면이 멈추지 않게)
import { FilesetResolver, InteractiveSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

let segmenter = null;

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      const vision = await FilesetResolver.forVisionTasks(m.wasm);
      // MediaPipe는 옛날 방식(importScripts)으로 엔진 파일을 불러오는데 모듈 작업 공간엔 그게 없어서,
      // 엔진 파일을 직접 받아 실행해 두고 importScripts는 아무것도 안 하게 바꿔 둠
      const code = await (await fetch(vision.wasmLoaderPath)).text();
      (0, eval)(code);
      self.importScripts = () => {};
      const make = (delegate) => InteractiveSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: m.model, delegate },
        outputCategoryMask: true, outputConfidenceMasks: false
      });
      try { segmenter = await make('GPU'); } catch (err) { segmenter = await make('CPU'); }
      self.postMessage({ type: 'ready' });
    } else if (m.type === 'segment') {
      // 받은 점마다 그 점에 있는 물체 마스크를 돌려줌
      const masks = [];
      for (const [x, y] of m.points) {
        let out = null;
        segmenter.segment(m.bitmap, { keypoint: { x, y } }, (res) => { out = res.categoryMask.getAsUint8Array().slice(); });
        masks.push(out);
      }
      m.bitmap.close();
      self.postMessage({ type: 'result', id: m.id, masks }, masks.filter(Boolean).map(a => a.buffer));
    }
  } catch (err) {
    self.postMessage({ type: m.type === 'init' ? 'error' : 'result', id: m.id, masks: [], message: String(err) });
  }
};
