// DSH passes the active Agent as `scope` to section text providers. Older
// prompt assemblers also exposed it as `agent`; keep that path for compatibility.
export function promptSessionId(context) {
  const agent = context?.scope ?? context?.agent
  return agent?.session?.id ?? agent?.id
}
