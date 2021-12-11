'use strict';

module.exports = class Dictionary {

    constructor(sourceLang, targetLang) {
        this.sourceLang = sourceLang;
        this.targetLang = targetLang;
        this.entries = {};
    }

    addEntry(source, target, wordType) {
        // source is the full source language entry, but key is stripped down

        // remove bracketed annotations
        var key = source.replace(/\[[^\]]*\]/g, "");
        key = key.replace(/\([^\)]*\)/g, "");
        key = key.replace(/\{[^\}]*\}/g, "");
        key = key.replace(/<[^>]*>/g, "");

        if (key.includes(" ")) {
            // remove annotations like sb., sth., etc.
            key = key.replace(/[^\s0-9]+\./, "");
        }

        // condense spaces left over from above substitutions
        key = key.replace(/\s+/g, " ").trim();

        // ignore multi-word entries
        if (key.includes(" "))
            return false;

        var entry = {};
        entry["key"] = key;
        entry["source"] = source;
        entry["target"] = target;
        entry["wordType"] = wordType;

        if (!(key in this.entries))
            this.entries[key] = [];

        return this.entries[key].push(entry);
    }

    lookup(term) {
        var entries = this.entries[term];
        if (entries == null)
            return [];
        else {
            // consolidate
            let consolidated = {}; 
            for (let entry of entries) {
                let conKey = entry.wordType + ": " + entry.source;
                if (!(conKey in consolidated)) {
                    consolidated[conKey] = {key: term, source: entry.source, wordType: entry.wordType, targets:[]};
                }
                consolidated[conKey].targets.push(entry.target);
            }
            let results = [];
            for (let [conKey, entry] of Object.entries(consolidated)) {
                entry.targets = entry.targets.sort((a, b) => {
                    // put meaning without annotations first - they are likely to be more common
                    if (!a.includes("[") && b.includes("["))
                        return -1;
                    else if (a.includes("[") && !b.includes("["))
                        return 1;
                    else
                        return 0;
                });
                results.push(entry);
            }
            return results;
        }
    }
}