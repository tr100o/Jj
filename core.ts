// Pure logic: no Discord imports, so it can be tested offline.
export const VIEW_CHANNEL = 1n << 10n

const TYPE_NAMES: Record<number, string> = {
	0: 'نصية', 2: 'صوتية', 4: 'تصنيف', 5: 'إعلانات', 13: 'ستيج', 15: 'منتدى', 16: 'وسائط',
}

export interface Hidden {
	id: string
	name: string
	type: string
	category: string
	topic: string
	roles: string[]
	members: number
	position: number
}

type Dict<T> = Record<string, T>

/** channels = all channels the client knows for the guild (id -> channel). */
export function collectHidden(opts: {
	channels: Dict<any>
	canView: (ch: any) => boolean
	roleName: (id: string) => string | undefined
}): Hidden[] {
	const all = Object.values(opts.channels)
	const cats: Dict<any> = {}
	for (const c of all) if (c.type === 4) cats[c.id] = c

	const out: Hidden[] = []
	for (const c of all) {
		if (c.type === 4) continue // categories are shown as the parent label
		let visible = true
		try { visible = opts.canView(c) } catch { continue }
		if (visible) continue

		const ow: any[] = Object.values(c.permissionOverwrites ?? {})
		const roles = ow
			.filter(o => o.type === 0 && (BigInt(o.allow ?? 0) & VIEW_CHANNEL) !== 0n)
			.map(o => opts.roleName(o.id) ?? `role:${o.id}`)
		const members = ow.filter(o => o.type === 1 && (BigInt(o.allow ?? 0) & VIEW_CHANNEL) !== 0n).length

		out.push({
			id: c.id,
			name: c.name ?? '?',
			type: TYPE_NAMES[c.type] ?? `نوع ${c.type}`,
			category: cats[c.parent_id ?? c.parentId]?.name ?? '—',
			topic: c.topic ?? '',
			roles,
			members,
			position: c.position ?? 0,
		})
	}
	return out.sort((a, b) => a.category.localeCompare(b.category) || a.position - b.position)
}

export function formatGuild(name: string, list: Hidden[], maxChars = 1400): string {
	let s = `${name}\nقنوات مخفية: ${list.length}\n`
	let lastCat = ''
	for (const h of list) {
		let block = ''
		if (h.category !== lastCat) { block += `\n▸ ${h.category}\n`; lastCat = h.category }
		block += ` • ${h.name} (${h.type})`
		if (h.roles.length) block += `\n   رتب: ${h.roles.slice(0, 4).join('، ')}${h.roles.length > 4 ? '…' : ''}`
		if (h.members) block += `\n   أشخاص: ${h.members}`
		if (h.topic) block += `\n   وصف: ${h.topic.slice(0, 60)}`
		block += '\n'
		if ((s + block).length > maxChars) return s + '\n… (القائمة مقتطعة)'
		s += block
	}
	return s
}
