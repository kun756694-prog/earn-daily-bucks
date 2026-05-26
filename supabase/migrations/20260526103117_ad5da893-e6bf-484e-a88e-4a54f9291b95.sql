REVOKE EXECUTE ON FUNCTION public.claim_task_reward_atomic(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_task_reward_atomic(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_task_reward_atomic(uuid, text, integer) TO authenticated;