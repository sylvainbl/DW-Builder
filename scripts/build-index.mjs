import fs from 'fs/promises'
import path from 'path'

const root = path.resolve('.')
const dataDir = path.join(root, 'data')
const publicDataDir = path.join(root, 'public', 'data')

async function ensurePublicDataDir() {
    await fs.mkdir(publicDataDir, { recursive: true })
}

async function loadJson(file) {
    const content = await fs.readFile(path.join(dataDir, file), 'utf-8')
    return JSON.parse(content)
}

async function writeJson(file, data) {
    await fs.writeFile(path.join(publicDataDir, file), JSON.stringify(data, null, 2), 'utf-8')
}

async function build() {
    await ensurePublicDataDir()

    const factions = await loadJson('factions.json')
    const glossary = await loadJson('glossary.json')
    const generators = await loadJson('generators.json')

    const units = []

    for (const faction of factions) {
        const factionUnitsDir = path.join(dataDir, 'units', faction.id)
        let files = []
        try {
            files = await fs.readdir(factionUnitsDir)
        } catch {
            continue
        }
        for (const filename of files.filter((name) => name.endsWith('.json'))) {
            const raw = await fs.readFile(path.join(factionUnitsDir, filename), 'utf-8')
            const unit = JSON.parse(raw)
            const id = `${faction.id}_${path.basename(filename, '.json')}`
            units.push({ ...unit, id, faction_id: faction.id })
        }
    }

    await writeJson('factions.json', factions)
    await writeJson('glossary.json', glossary)
    await writeJson('generators.json', generators)
    await writeJson('units-index.json', units)

    console.log(`Generated ${units.length} units across ${factions.length} factions.`)
}

build().catch((error) => {
    console.error(error)
    process.exit(1)
})
