/**
 * Hidden Channels Viewer (v0.1, diagnostic build).
 * Read-only. Uses only data Discord already delivered to this client. No network, no token.
 * UNVERIFIED on a device: store lookup goes through Metro's module registry (globalThis.modules).
 */
import { collectHidden, formatGuild, VIEW_CHANNEL } from './core'

const TAG = '[hidden-channels]'

function findAlert(): any {
	const mods = (globalThis as any).modules
	if (!mods) return undefined
	for (const id of Object.keys(mods)) {
		const m = mods[id]
		if (!m?.isInitialized) continue
		const ex = m.publicModule?.exports
		for (const c of [ex?.default, ex]) {
			try { if (c && typeof c.alert === 'function' && typeof c.prompt === 'function') return c } catch {}
		}
	}
}
const Alert: any = { alert: (...a: any[]) => { const A = findAlert(); if (A) A.alert(...a); else console.log(TAG, ...a) } }

function findStore(name: string): any {
	const mods = (globalThis as any).modules
	if (!mods) return undefined
	for (const id of Object.keys(mods)) {
		const m = mods[id]
		if (!m?.isInitialized) continue // never force-initialize modules
		const ex = m.publicModule?.exports
		for (const c of [ex?.default, ex]) {
			try {
				if (c && typeof c.getName === 'function' && c.getName() === name) return c
			} catch {}
		}
	}
	return undefined
}

function run() {
	const Channels = findStore('ChannelStore')
	const Guilds = findStore('GuildStore')
	const Perms = findStore('PermissionStore')
	const Roles = findStore('GuildRoleStore')
	const Selected = findStore('SelectedGuildStore')

	const status = { ChannelStore: !!Channels, GuildStore: !!Guilds, PermissionStore: !!Perms, GuildRoleStore: !!Roles }
	console.log(TAG, 'stores', JSON.stringify(status))

	const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k)
	if (missing.length || typeof Channels.getMutableGuildChannelsForGuild !== 'function' || typeof Perms.can !== 'function') {
		Alert.alert('Hidden Channels', `لم أجد واجهات Discord المطلوبة:\n${missing.join(', ') || 'دوال ناقصة في ChannelStore/PermissionStore'}\n\nأرسل لي هذه الرسالة.`)
		return
	}

	const guilds: any[] = Object.values(Guilds.getGuilds?.() ?? {})
	const results: { name: string; text: string; count: number }[] = []
	let totalKnown = 0
	for (const g of guilds) {
		const channels = Channels.getMutableGuildChannelsForGuild(g.id) ?? {}
		totalKnown += Object.keys(channels).length
		const list = collectHidden({
			channels,
			canView: ch => Perms.can(VIEW_CHANNEL, ch),
			roleName: id => Roles.getRole?.(g.id, id)?.name,
		})
		if (list.length) results.push({ name: g.name, text: formatGuild(g.name, list), count: list.length })
	}

	console.log(TAG, `guilds=${guilds.length} channelsKnown=${totalKnown} guildsWithHidden=${results.length}`)

	if (!results.length) {
		Alert.alert('Hidden Channels',
			`فحصت ${guilds.length} سيرفر (${totalKnown} قناة معروفة للتطبيق).\nلا توجد قنوات مخفية وصلت بياناتها لتطبيقك.\n\nهذا يعني على الأرجح أن Discord لا يرسل هذه البيانات للجوال، ولا يمكن لأي إضافة عرضها.`)
		return
	}

	const currentId = Selected?.getGuildId?.()
	results.sort((a, b) => Number(b.name === guilds.find(g => g.id === currentId)?.name) - Number(a.name === guilds.find(g => g.id === currentId)?.name))

	const show = (i: number) => {
		const r = results[i]
		Alert.alert(`مخفية (${i + 1}/${results.length})`, r.text, [
			{ text: 'إغلاق', style: 'cancel' },
			...(i + 1 < results.length ? [{ text: 'السيرفر التالي', onPress: () => show(i + 1) }] : []),
		])
	}
	show(0)
}

export default plugin({
	start() {
		Alert.alert('Hidden Channels', 'الإضافة اشتغلت. ستظهر النتيجة بعد ثوانٍ.')
		// Give Discord a moment to finish loading guild data.
		setTimeout(() => {
			try { run() } catch (e) { console.error(TAG, e); Alert.alert('Hidden Channels', `خطأ: ${String(e)}`) }
		}, 6000)
	},
	stop() {},
})
