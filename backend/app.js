const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors()); // 允许跨域请求
app.use(bodyParser.json());

// 静态文件路径，用于访问前端生成的文件
app.use(express.static(path.join(__dirname, 'public')));

// 模板文件路径
const templatesDir = path.join(__dirname, 'templates');

// 加载模板列表
app.get('/get-templates', (req, res) => {
    fs.readdir(templatesDir, (err, files) => {
        if (err) {
            return res.status(500).json({ error: '读取模板失败' });
        }
        const templates = files.map(file => ({
            file,
            name: path.basename(file, '.json')
        }));
        res.json({ templates });
    });
});

// 加载具体模板内容
app.get('/load-template', (req, res) => {
    const templateFile = req.query.file;
    if (!templateFile) {
        return res.status(400).json({ error: '模板文件未提供' });
    }

    const templatePath = path.join(templatesDir, templateFile);
    fs.readFile(templatePath, 'utf-8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: '加载模板失败' });
        }
        try {
            const template = JSON.parse(data);
            res.json(template);
        } catch (error) {
            res.status(500).json({ error: '模板解析错误' });
        }
    });
});

// 生成数据逻辑
app.post('/generate', (req, res) => {
    const { file_name, total_columns, columns, rows_count = 10 } = req.body;

    if (!file_name || !total_columns || !columns) {
        return res.status(400).json({ error: '请求参数无效' });
    }

    const data = generateData(total_columns, columns, rows_count);
    const filePath = path.join(__dirname, 'public', `${file_name}.csv`);

    saveToCSV(filePath, data, columns)
        .then(() => res.json({ message: `数据文件生成成功: ${filePath}` }))
        .catch(err => res.status(500).json({ error: '文件保存失败' }));
});

// 生成数据的核心函数
function generateData(totalColumns, columnsConfig, rowCount) {
    const data = [];
    for (let i = 0; i < rowCount; i++) {
        const row = Array(totalColumns).fill('');
        columnsConfig.forEach(column => {
            const position = column.position - 1;
            row[position] = generateColumnData(column);
        });
        data.push(row);
    }
    return data;
}

// 针对不同类型生成数据
function generateColumnData(column) {
    switch (column.type) {
        case 'fixed':
            return column.value || '';
        case 'random_number':
            return Math.floor(Math.random() * (column.end - column.start + 1)) + column.start;
        case 'patterned_number':
            return `${column.prefix || ''}${column.start + column.step * (Math.floor(Math.random() * 10))}${column.suffix || ''}`;
        case 'text':
            return generateRandomText(column.textType, column.length);
        case 'date':
            return generateDate(column);
        default:
            return '';
    }
}

// 生成随机文本
function generateRandomText(type, length = 10) {
    const hiragana = 'あいうえおかきくけこさしすせそ';
    const katakana = 'アイウエオカキクケコサシスセソ';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let pool = alphabet;
    
    if (type === 'hiragana') pool = hiragana;
    else if (type === 'katakana') pool = katakana;

    return Array.from({ length }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
}

// 生成日期
function generateDate(column) {
    const now = new Date();
    if (column.generationMethod === 'current') return now.toISOString();
    if (column.generationMethod === 'random') {
        const randomDate = new Date(now.getTime() - Math.floor(Math.random() * 10000000000));
        return randomDate.toISOString();
    }
    return column.specificDate || now.toISOString();
}

// 保存数据到 CSV 文件
function saveToCSV(filePath, data, columns) {
    return new Promise((resolve, reject) => {
        const csvHeader = columns.map(col => col.name).join(',') + '\n';
        const csvData = data.map(row => row.join(',')).join('\n');

        fs.writeFile(filePath, csvHeader + csvData, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`服务正在监听端口: ${port}`);
});
