import { family, type FamilyDoc } from './family';
import { inventory } from '../state/inventory';
import { progress } from '../state/progress';
import { village } from '../state/village';

/** 지금 이 기기의 진행을 가족 섬 문서 모양으로 */
export function localDoc(): FamilyDoc {
  return { ...inventory.exportDoc(), ...progress.exportDoc(), ...village.exportDoc(), feed: [] };
}

/** 가족 섬 문서가 바뀔 때마다 저장소를 최신 상태로 맞춘다 */
family.on('doc', (d: FamilyDoc) => {
  inventory.applyRemote(d.inv, d.order);
  progress.applyRemote(d.unlocked, d.boats, d.treasures);
  village.applyRemote(d as never);
});

void family.init();
