import { formatGroupLabel, operationGroup, type APIGroup, type APIOperation } from './contract'

export function catalogPath(api: APIOperation, modules: APIGroup[]): string[] {
  const [root, ...parts] = operationGroup(api)
  return [modules.find(group => group.key === '/' + root)?.label ?? formatGroupLabel(root), ...parts.map(formatGroupLabel)]
}

/** Use the contract's categories as landmarks, including tags below a single wrapper group. */
export function modulePreview(group: APIGroup): string {
  let branch = group
  while (branch.children.length === 1 && !branch.operations.length) branch = branch.children[0]
  const names = branch.children.length ? branch.children.map(child => child.label) : branch.operations.map(api => api.operation.summary || api.action || api.path)
  return names.slice(0, 3).join(' · ')
}
