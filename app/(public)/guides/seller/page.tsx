import {editorialMetadata} from '../../../../components/EditorialPage';
import GuideDetail from '../../../../components/GuideDetail';

export const metadata = editorialMetadata('/guides/seller');
export default function Page() { return <GuideDetail role="seller" />; }
