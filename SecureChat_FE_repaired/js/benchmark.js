import {
    encryptMessage,
    decryptMessage
} from "./crypto/aes.js";

import {
    encryptDESMessage,
    decryptDESMessage
} from "./crypto/des.js";

const encoder =
    new TextEncoder();

const algorithmSelect =
    document.getElementById(
        "algorithm"
    );

const inputSizeSelect =
    document.getElementById(
        "inputSize"
    );

const iterationsInput =
    document.getElementById(
        "iterations"
    );

const btnRun =
    document.getElementById(
        "btnRun"
    );

const btnExport =
    document.getElementById(
        "btnExport"
    );

const btnClear =
    document.getElementById(
        "btnClear"
    );

const statusEl =
    document.getElementById(
        "status"
    );

const resultBody =
    document.getElementById(
        "resultBody"
    );

const summaryTests =
    document.getElementById(
        "summaryTests"
    );

const summaryRuns =
    document.getElementById(
        "summaryRuns"
    );

const summaryEncrypt =
    document.getElementById(
        "summaryEncrypt"
    );

const summaryDecrypt =
    document.getElementById(
        "summaryDecrypt"
    );


let results = [];


// ==========================================
// UTILITY
// ==========================================

function setStatus(
    text,
    type = ""
) {
    statusEl.textContent =
        text;

    statusEl.className =
        type;
}


function average(values) {

    if (!values.length) {
        return 0;
    }

    return (
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        ) /
        values.length
    );
}


function median(values) {

    if (!values.length) {
        return 0;
    }

    const sorted =
        [...values]
            .sort(
                (a, b) =>
                    a - b
            );

    const middle =
        Math.floor(
            sorted.length / 2
        );

    if (
        sorted.length % 2 === 0
    ) {
        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;
    }

    return sorted[middle];
}


function stdDev(values) {

    if (!values.length) {
        return 0;
    }

    const avg =
        average(values);

    const variance =
        average(
            values.map(
                value =>
                    (
                        value -
                        avg
                    ) ** 2
            )
        );

    return Math.sqrt(
        variance
    );
}


function byteLength(value) {

    return encoder
        .encode(
            String(value)
        )
        .length;
}


function jsonByteLength(value) {

    return byteLength(
        JSON.stringify(value)
    );
}


// ==========================================
// SINH DỮ LIỆU ĐÚNG SỐ BYTE
// ==========================================

function createPayload(
    size
) {

    // ký tự "a" = 1 byte UTF-8
    return "a".repeat(size);
}


// ==========================================
// BASE64 SIZE
// ==========================================

function base64DecodedBytes(
    value
) {

    if (!value) {
        return 0;
    }

    try {

        const normalized =
            String(value)
                .replace(
                    /-/g,
                    "+"
                )
                .replace(
                    /_/g,
                    "/"
                );

        const binary =
            atob(normalized);

        return binary.length;

    } catch {

        return 0;

    }
}


// ==========================================
// AES
// ==========================================

async function createAESKey(
    bits
) {

    return crypto.subtle
        .generateKey(
            {
                name: "AES-GCM",
                length: bits
            },

            true,

            [
                "encrypt",
                "decrypt"
            ]
        );
}


async function benchmarkAES(
    keyBits,
    inputBytes,
    iterations
) {

    const key =
        await createAESKey(
            keyBits
        );

    const plaintext =
        createPayload(
            inputBytes
        );

    const encryptTimes = [];
    const decryptTimes = [];

    let lastEnvelope = null;


    for (
        let i = 0;
        i < iterations;
        i++
    ) {

        const startEncrypt =
            performance.now();


        const encryptedJson =
            await encryptMessage(
                plaintext,
                key,
                `benchmark-aes-${keyBits}`
            );


        const endEncrypt =
            performance.now();


        encryptTimes.push(
            endEncrypt -
            startEncrypt
        );


        lastEnvelope =
            JSON.parse(
                encryptedJson
            );


        const startDecrypt =
            performance.now();


        const decrypted =
            await decryptMessage(
                encryptedJson,
                key
            );


        const endDecrypt =
            performance.now();


        if (
            decrypted !==
            plaintext
        ) {
            throw new Error(
                `AES-${keyBits} giải mã không khớp dữ liệu gốc.`
            );
        }


        decryptTimes.push(
            endDecrypt -
            startDecrypt
        );
    }


    const ivBytes =
        Array.isArray(
            lastEnvelope.iv
        )
            ? lastEnvelope.iv.length
            : base64DecodedBytes(
                lastEnvelope.iv
            );


    const ciphertextBytes =
        Array.isArray(
            lastEnvelope.ciphertext
        )
            ? lastEnvelope
                .ciphertext
                .length
            : base64DecodedBytes(
                lastEnvelope
                    .ciphertext
            );


    // Web Crypto AES-GCM thường gắn tag vào ciphertext.
    // 128 bit = 16 bytes.
    const tagBytes = 16;


    return {

        algorithm:
            "AES-GCM",

        keyBits,

        inputBytes,

        ciphertextBytes,

        ivBytes,

        tagOrMacBytes:
            tagBytes,

        wireBytes:
            jsonByteLength(
                lastEnvelope
            ),

        encryptAvg:
            average(
                encryptTimes
            ),

        encryptMedian:
            median(
                encryptTimes
            ),

        encryptStd:
            stdDev(
                encryptTimes
            ),

        decryptAvg:
            average(
                decryptTimes
            ),

        decryptMedian:
            median(
                decryptTimes
            ),

        decryptStd:
            stdDev(
                decryptTimes
            ),

        iterations
    };
}


// ==========================================
// DES
// ==========================================

function randomHex(
    bytes
) {

    const data =
        new Uint8Array(
            bytes
        );

    crypto.getRandomValues(
        data
    );

    return Array
        .from(
            data,
            value =>
                value
                    .toString(16)
                    .padStart(
                        2,
                        "0"
                    )
        )
        .join("");
}


async function benchmarkDES(
    inputBytes,
    iterations
) {

    const plaintext =
        createPayload(
            inputBytes
        );

    const desKeyHex =
        randomHex(8);

    const macKeyHex =
        randomHex(32);

    const encryptTimes = [];
    const decryptTimes = [];

    let lastEnvelope = null;


    for (
        let i = 0;
        i < iterations;
        i++
    ) {

        const startEncrypt =
            performance.now();


        const encryptedJson =
            await encryptDESMessage(
                plaintext,
                desKeyHex,
                macKeyHex,
                "benchmark-des"
            );


        const endEncrypt =
            performance.now();


        encryptTimes.push(
            endEncrypt -
            startEncrypt
        );


        lastEnvelope =
            JSON.parse(
                encryptedJson
            );


        const startDecrypt =
            performance.now();


        const decrypted =
            await decryptDESMessage(
                encryptedJson,
                desKeyHex,
                macKeyHex
            );


        const endDecrypt =
            performance.now();


        if (
            decrypted !==
            plaintext
        ) {
            throw new Error(
                "DES giải mã không khớp dữ liệu gốc."
            );
        }


        decryptTimes.push(
            endDecrypt -
            startDecrypt
        );
    }


    // DES module đang trả hex
    const ivBytes =
        lastEnvelope.iv
            ? lastEnvelope.iv.length / 2
            : 0;


    const ciphertextBytes =
        lastEnvelope.ciphertext
            ? lastEnvelope
                .ciphertext
                .length / 2
            : 0;


    const macBytes =
        lastEnvelope.mac
            ? lastEnvelope.mac.length / 2
            : 0;


    return {

        algorithm:
            "DES-CBC",

        keyBits:
            56,

        inputBytes,

        ciphertextBytes,

        ivBytes,

        tagOrMacBytes:
            macBytes,

        wireBytes:
            jsonByteLength(
                lastEnvelope
            ),

        encryptAvg:
            average(
                encryptTimes
            ),

        encryptMedian:
            median(
                encryptTimes
            ),

        encryptStd:
            stdDev(
                encryptTimes
            ),

        decryptAvg:
            average(
                decryptTimes
            ),

        decryptMedian:
            median(
                decryptTimes
            ),

        decryptStd:
            stdDev(
                decryptTimes
            ),

        iterations
    };
}


// ==========================================
// RENDER
// ==========================================

function formatMs(
    value
) {

    return Number(
        value
    ).toFixed(4);
}


function renderResults() {

    resultBody.innerHTML =
        "";


    if (!results.length) {

        resultBody.innerHTML = `
            <tr>
                <td
                    colspan="14"
                    class="empty"
                >
                    Chưa có dữ liệu.
                </td>
            </tr>
        `;

        return;
    }


    for (
        const row
        of results
    ) {

        const tr =
            document.createElement(
                "tr"
            );


        const values = [

            row.algorithm,

            row.keyBits,

            row.inputBytes,

            row.ciphertextBytes,

            row.ivBytes,

            row.tagOrMacBytes,

            row.wireBytes,

            formatMs(
                row.encryptAvg
            ),

            formatMs(
                row.encryptMedian
            ),

            formatMs(
                row.encryptStd
            ),

            formatMs(
                row.decryptAvg
            ),

            formatMs(
                row.decryptMedian
            ),

            formatMs(
                row.decryptStd
            ),

            row.iterations

        ];


        for (
            const value
            of values
        ) {

            const td =
                document.createElement(
                    "td"
                );

            td.textContent =
                value;

            tr.appendChild(
                td
            );
        }


        resultBody.appendChild(
            tr
        );
    }
}


function renderSummary() {

    summaryTests.textContent =
        results.length;


    summaryRuns.textContent =
        results.reduce(
            (
                total,
                row
            ) =>
                total +
                row.iterations,

            0
        );


    if (!results.length) {

        summaryEncrypt.textContent =
            "—";

        summaryDecrypt.textContent =
            "—";

        return;
    }


    const fastestEncrypt =
        results.reduce(
            (best, row) =>
                row.encryptAvg <
                best.encryptAvg
                    ? row
                    : best
        );


    const fastestDecrypt =
        results.reduce(
            (best, row) =>
                row.decryptAvg <
                best.decryptAvg
                    ? row
                    : best
        );


    summaryEncrypt.textContent =
        `${
            fastestEncrypt.algorithm
        } ${
            fastestEncrypt.keyBits
        }b`;


    summaryDecrypt.textContent =
        `${
            fastestDecrypt.algorithm
        } ${
            fastestDecrypt.keyBits
        }b`;
}


// ==========================================
// RUN
// ==========================================

async function runBenchmark() {

    const selectedAlgorithm =
        algorithmSelect.value;


    const selectedSize =
        inputSizeSelect.value;


    const iterations =
        Number(
            iterationsInput.value
        );


    if (
        !Number.isInteger(
            iterations
        ) ||
        iterations < 1 ||
        iterations > 1000
    ) {

        setStatus(
            "Số lần lặp phải từ 1 đến 1000.",
            "error"
        );

        return;
    }


    const algorithms =
        selectedAlgorithm ===
        "ALL"
            ? [
                "AES-128",
                "AES-192",
                "AES-256",
                "DES"
            ]
            : [
                selectedAlgorithm
            ];


    const sizes =
        selectedSize ===
        "ALL"
            ? [
                32,
                256,
                1024,
                10240
            ]
            : [
                Number(
                    selectedSize
                )
            ];


    btnRun.disabled =
        true;

    btnExport.disabled =
        true;


    results = [];

    renderResults();

    renderSummary();


    try {

        const totalTests =
            algorithms.length *
            sizes.length;

        let currentTest =
            0;


        for (
            const algorithm
            of algorithms
        ) {

            for (
                const size
                of sizes
            ) {

                currentTest++;


                setStatus(
                    `Đang đo ${currentTest}/${totalTests}: ${algorithm}, ${size} bytes...`
                );


                let result;


                if (
                    algorithm.startsWith(
                        "AES-"
                    )
                ) {

                    const bits =
                        Number(
                            algorithm.split(
                                "-"
                            )[1]
                        );


                    result =
                        await benchmarkAES(
                            bits,
                            size,
                            iterations
                        );

                } else {

                    result =
                        await benchmarkDES(
                            size,
                            iterations
                        );

                }


                results.push(
                    result
                );


                renderResults();

                renderSummary();


                // nhường UI cập nhật
                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            20
                        )
                );
            }
        }


        setStatus(
            `Hoàn thành ${results.length} cấu hình benchmark.`,
            "success"
        );


        btnExport.disabled =
            false;

    } catch (error) {

        console.error(
            error
        );


        setStatus(
            `Benchmark lỗi: ${error.message}`,
            "error"
        );

    } finally {

        btnRun.disabled =
            false;

    }
}


// ==========================================
// CSV
// ==========================================

function exportCSV() {

    if (!results.length) {
        return;
    }


    const headers = [

        "algorithm",

        "keyBits",

        "inputBytes",

        "ciphertextBytes",

        "ivBytes",

        "tagOrMacBytes",

        "wireBytes",

        "encryptAvgMs",

        "encryptMedianMs",

        "encryptStdMs",

        "decryptAvgMs",

        "decryptMedianMs",

        "decryptStdMs",

        "iterations"

    ];


    const rows =
        results.map(
            row => [

                row.algorithm,

                row.keyBits,

                row.inputBytes,

                row.ciphertextBytes,

                row.ivBytes,

                row.tagOrMacBytes,

                row.wireBytes,

                row.encryptAvg,

                row.encryptMedian,

                row.encryptStd,

                row.decryptAvg,

                row.decryptMedian,

                row.decryptStd,

                row.iterations

            ]
        );


    const csv =
        [
            headers,
            ...rows
        ]

            .map(
                row =>
                    row.join(",")
            )

            .join("\n");


    const blob =
        new Blob(
            [
                csv
            ],
            {
                type:
                    "text/csv;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        `secure-chat-benchmark-${Date.now()}.csv`;


    link.click();


    URL.revokeObjectURL(
        url
    );
}


// ==========================================
// EVENTS
// ==========================================

btnRun.addEventListener(
    "click",
    runBenchmark
);


btnExport.addEventListener(
    "click",
    exportCSV
);


btnClear.addEventListener(
    "click",
    () => {

        results = [];

        renderResults();

        renderSummary();

        btnExport.disabled =
            true;

        setStatus(
            "Đã xóa kết quả."
        );

    }
);