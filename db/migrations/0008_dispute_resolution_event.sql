-- 006.4 proposal: requires separate owner approval before applying.
-- Only expands the allowed immutable case-event kinds. No financial table changes.
ALTER TABLE public.dispute_case_events DROP CONSTRAINT dispute_case_events_kind_check;
ALTER TABLE public.dispute_case_events ADD CONSTRAINT dispute_case_events_kind_check
 CHECK (kind IN ('opened','message','review_started','information_requested','evidence_added','resolution'));
