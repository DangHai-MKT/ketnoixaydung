import {editorialMetadata} from '../../../../components/EditorialPage';
import GuideDetail from '../../../../components/GuideDetail';

export const metadata = editorialMetadata('/guides/buyer');
export default function Page() { return <GuideDetail role="buyer" />; }
