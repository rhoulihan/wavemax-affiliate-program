const fs = require('fs');

// Add missing bagNote translation
const enPath = './public/locales/en/common.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

if (en.customer && en.customer.register && !en.customer.register.bagNote) {
    en.customer.register.bagNote = 'This fee covers the cost of your laundry bags.';
    fs.writeFileSync(enPath, JSON.stringify(en, null, 2));
    console.log('Added bagNote to English translations');
} else {
    console.log('bagNote already exists in English translations');
}

// Add to other languages
const languages = ['es', 'pt', 'de'];
const translations = {
    es: 'Esta tarifa cubre el costo de sus bolsas de lavandería.',
    pt: 'Esta taxa cobre o custo das suas sacolas de lavanderia.',
    de: 'Diese Gebühr deckt die Kosten für Ihre Wäschesäcke.'
};

languages.forEach(lang => {
    const path = './public/locales/' + lang + '/common.json';
    try {
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (data.customer && data.customer.register && !data.customer.register.bagNote) {
            data.customer.register.bagNote = translations[lang];
            fs.writeFileSync(path, JSON.stringify(data, null, 2));
            console.log('Added bagNote to ' + lang + ' translations');
        } else {
            console.log('bagNote already exists in ' + lang + ' translations');
        }
    } catch (e) {
        console.log('Error with ' + lang + ':', e.message);
    }
});