import {ownerProjectApi, privateJson, readJson} from '../../../../../lib/projects/http';
import {priceContextInput} from '../../../../../lib/projects/price-learning';
import {suggestProjectPrice} from '../../../../../services/project-price-learning';

const requests = new Map<string, number>();

export async function POST(request: Request) {
  return ownerProjectApi(request, async actor => {
    const context = priceContextInput(await readJson(request));
    const now = Date.now();
    if ((requests.get(actor.id) ?? 0) > now) {
      return privateJson({error: 'Vui lòng đợi vài giây trước khi phân tích lại.'}, 429);
    }
    requests.delete(actor.id);
    requests.set(actor.id, now + 10000);
    if (requests.size > 4096) requests.delete(requests.keys().next().value!);
    return privateJson(await suggestProjectPrice(actor.id, context));
  });
}
