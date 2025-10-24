// js/utils.js

/**
 * Recria o 'path.basename' com JavaScript puro.
 */
export function basename(p) {
    if (typeof p !== 'string') return '';
    return p.split(/[\\/]/).pop();
}

/**
 * Formata uma data ISO para um formato legível
 */
export function formatLastPlayed(isoString) {
    if (!isoString) return 'Nunca';
    try {
        const date = new Date(isoString);
        // ... (resto do código da função formatLastPlayed)
        const now = new Date();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0, 0, 0, 0);
        const dateToCompare = new Date(date.getTime()); dateToCompare.setHours(0, 0, 0, 0);
        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (dateToCompare.getTime() === today.getTime()) return `Hoje, ${time}`;
        if (dateToCompare.getTime() === yesterday.getTime()) return `Ontem, ${time}`;
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return 'Data inválida';
    }
}