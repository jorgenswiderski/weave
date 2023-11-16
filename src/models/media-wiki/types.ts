import { ApiRevision } from 'mwn';

export interface IPageData extends ApiRevision {
    title: string;
    revisionId: any;
    categories: string[];
    pageId: number;
}
