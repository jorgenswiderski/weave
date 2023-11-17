export interface RevisionLockEntry {
    pageId: number;
    title: string;
    revisionId: number;
}

export interface RevisionLockInfo {
    revisions: RevisionLockEntry[];
    redirects: Record<string, string>;
    deadLinks: string[];
}
