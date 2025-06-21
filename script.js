// Показ / скрытие полей по выбору инструмента ===
document.getElementById("instrument").addEventListener("change", function () {
    const val = this.value;

    document.getElementById("forward-t-toggle").classList.add("hidden");
    document.getElementById("future-k-toggle").classList.add("hidden");
    document.getElementById("strike-toggle").classList.add("hidden");

    if (val === "Форвард") {
        document.getElementById("forward-t-toggle").classList.remove("hidden");
    } else if (val === "Фьючерс") {
        document.getElementById("future-k-toggle").classList.remove("hidden");
    } else if (val === "Европейский Call" || val === "Европейский Put" || val === "Американский Call" || val === "Американский Put") {
        document.getElementById("strike-toggle").classList.remove("hidden");
    }

    // Условие досрочного исполнения только для американских опционов
    document.getElementById("early-exercise-toggle").classList.toggle("hidden", !val.includes("Американский"));

    // Греки отображаем только для европейских опционов
    document.getElementById("greeks-toggle").classList.toggle("hidden", !val.includes("Европейский"));
});

// Обработка формы
document.getElementById("calcForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const n = parseInt(document.getElementById("n").value);
    const T = parseFloat(document.getElementById("T").value);
    const r0 = parseFloat(document.getElementById("r0").value.replace(",", ".")) / 100;
    const S0 = parseFloat(document.getElementById("S0").value.replace(",", "."));
    const sigma = parseFloat(document.getElementById("sigma").value.replace(",", "."));
    const t = parseInt(document.getElementById("t").value);
    const k = parseInt(document.getElementById("k").value);
    const E = parseFloat(document.getElementById("E").value.replace(",", "."));
    const instrument = document.getElementById("instrument").value;
    const showGreeks = document.getElementById("showGreeks").checked;
    const earlyExercise = document.getElementById("earlyExercise").checked;

    const E_decimal = E / 100;
    const strikePrice = E / 100 * S0;
    const dt = T / n;
    const u = Math.exp(sigma * Math.sqrt(dt));
    const d = 1 / u;
    const p = (Math.exp(r0 * dt) - d) / (u - d);
    const q = 1 - p;

    // Ставки
    const rates = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0));
    rates[0][0] = r0;
    for (let j = 1; j <= n; j++) {
        for (let i = 0; i <= j; i++) {
            rates[i][j] = r0 * Math.pow(u, j - i) * Math.pow(d, i);
        }
    }

    // ZCB дерево до T
    const ZCBn = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= n; i++) ZCBn[i][n] = S0;
    for (let j = n - 1; j >= 0; j--) {
        for (let i = 0; i <= j; i++) {
            ZCBn[i][j] = (p * ZCBn[i][j + 1] + q * ZCBn[i + 1][j + 1]) / (1 + rates[i][j]);
        }
    }

    // ZCB дерево до t (форвард)
    const ZCBt = Array.from({ length: t + 1 }, () => Array(t + 1).fill(0));
    for (let i = 0; i <= t; i++) ZCBt[i][t] = S0;
    for (let j = t - 1; j >= 0; j--) {
        for (let i = 0; i <= j; i++) {
            ZCBt[i][j] = (p * ZCBt[i][j + 1] + q * ZCBt[i + 1][j + 1]) / (1 + rates[i][j]);
        }
    }

    // Цена форварда
    const Ft = ZCBn[0][0] / ZCBt[0][0] * 100;

    // Дерево будущих цен актива
    const future = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= n; i++) future[i][k] = ZCBn[i][k];
    for (let j = k - 1; j >= 0; j--) {
        for (let i = 0; i <= j; i++) {
            future[i][j] = p * future[i][j + 1] + q * future[i + 1][j + 1];
        }
    }

    // Опцион европейский
    function normalCdf(x) {
        return 0.5 * (1 + erf(x / Math.sqrt(2)));
      }

      function normalPDF(x) {
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
      } 
      
      function erf(x) {
        // Численно приближённая функция ошибок
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        const a1 = 0.254829592,
              a2 = -0.284496736,
              a3 = 1.421413741,
              a4 = -1.453152027,
              a5 = 1.061405429,
              p = 0.3275911;
      
        const t = 1 / (1 + p * x);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
      }
      
    function blackScholes(S, Е, T, r, sigma, isCall) {
        const d1 = (Math.log(S / Е) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        const Nd1 = normalCdf(isCall ? d1 : -d1);
        const Nd2 = normalCdf(isCall ? d2 : -d2);
        if (isCall) {
          return S * normalCdf(d1) - Е * Math.exp(-r * T) * normalCdf(d2);
        } else {
          return Е * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
        }
      }
      
      const optionPrice = (isCall, isEuro, isAmerican) => {
        if (!isAmerican) {
            // для европейских вызываем Black-Scholes
            return blackScholes(S0, strikePrice, r0, sigma, T, isCall);
        }
    
        // биномиальная модель для американского опциона
        const f = Array.from({ length: n + 1 }, () => Array(n + 1).fill(0));
        const payoff = (s) => isCall ? Math.max(s - strikePrice, 0) : Math.max(strikePrice - s, 0);
    
        for (let i = 0; i <= n; i++) {
            const S = S0 * Math.pow(u, n - i) * Math.pow(d, i);
            f[i][n] = payoff(S);
        }
        for (let j = n - 1; j >= 0; j--) {
            for (let i = 0; i <= j; i++) {
                const hold = (p * f[i][j + 1] + q * f[i + 1][j + 1]) / Math.exp(r0 * dt);
                const S = S0 * Math.pow(u, j - i) * Math.pow(d, i);
                const exercise = payoff(S);
                f[i][j] = Math.max(hold, exercise);
            }
        }
        return f[0][0];
    };

    // Результат
    let result = "";
    let optionPriceVal = 0;
    
    if (instrument === "Форвард") {
        result = `<b>Цена форварда:</b> ${Ft.toFixed(4)}`;
    } else if (instrument === "Фьючерс") {
        result = `<b>Цена фьючерса:</b> ${future[0][0].toFixed(4)}`;
    } else if (instrument === "Европейский Call") {
        optionPriceVal = optionPrice(true, true, false);
        result = `<b>Цена европейского Call:</b> ${optionPriceVal.toFixed(4)}`;
    } else if (instrument === "Европейский Put") {
        optionPriceVal = optionPrice(false, true, false);
        result = `<b>Цена европейского Put:</b> ${optionPriceVal.toFixed(4)}`;
    } else if (instrument === "Американский Call") {
        optionPriceVal = optionPrice(true, false, earlyExercise);
        result = `<b>Цена американского Call:</b> ${optionPriceVal.toFixed(4)}`;
    } else if (instrument === "Американский Put") {
        optionPriceVal = optionPrice(false, false, earlyExercise);
        result = `<b>Цена американского Put:</b> ${optionPriceVal.toFixed(4)}`;
    }
    
    const isCall = instrument.includes("Call");
    const isAmerican = instrument.includes("Американский");
    const isEuro = instrument.includes("Европейский");
    
    // Греческие коэффициенты
    function blackScholesGreeks(S, E, T, r, sigma, isCall) {
        const d1 = (Math.log(S / E) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        const φ = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
        const Φ = normalCdf;
    
        const Delta = isCall ? Φ(d1) : Φ(d1) - 1;
        const Gamma = φ(d1) / (S * sigma * Math.sqrt(T));
        const Vega = S * Math.sqrt(T) * φ(d1);
        const Theta = isCall
            ? -(S * φ(d1) * sigma) / (2 * Math.sqrt(T)) - r * E * Math.exp(-r * T) * Φ(d2)
            : -(S * φ(d1) * sigma) / (2 * Math.sqrt(T)) + r * E * Math.exp(-r * T) * Φ(-d2);
        const Rho = isCall
            ? E * T * Math.exp(-r * T) * Φ(d2)
            : -E * T * Math.exp(-r * T) * Φ(-d2);
    
        return { Delta, Gamma, Vega, Theta, Rho };
    }
    
    if (showGreeks && instrument.includes("Европейский")) {
        const isCall = instrument.includes("Call");
        const greeks = blackScholesGreeks(S0, strikePrice, T, r0, sigma, isCall);
        window.greeksResult = greeks;

        result += `
        <hr><b>Греческие коэффициенты:</b><br>
        Δ (Delta): ${greeks.Delta.toFixed(4)} <br>
        Γ (Gamma): ${greeks.Gamma.toFixed(4)} <br>
        Vega: ${greeks.Vega.toFixed(4)} <br>
        ρ (Rho): ${greeks.Rho.toFixed(4)} <br>
        Θ (Theta): ${greeks.Theta.toFixed(4)}
        `;
    }


    document.getElementById("result").innerHTML = result;
    await runAnalysis(S0, sigma, r0, T, E, isCall, isAmerican, optionPriceVal, instrument, isEuro, strikePrice);

});
// Кнопка Очистки
function clearForm() {
    document.getElementById("calcForm").reset();
    document.getElementById("result").innerHTML = "";
    document.getElementById("forward-t-toggle").classList.add("hidden");
    document.getElementById("future-k-toggle").classList.add("hidden");
    document.getElementById("strike-toggle").classList.add("hidden");
    document.getElementById("early-exercise-toggle").classList.add("hidden");
    document.getElementById("greeks-toggle").classList.add("hidden");
}

// Анимация фона
const canvas = document.getElementById("bg-animation");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.position = "fixed";
canvas.style.top = 0;
canvas.style.left = 0;
canvas.style.zIndex = -1;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);

let angle = 0;
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) * 1.1;
    const sides = 8;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    for (let i = 0; i < sides; i++) {
        const a1 = (2 * Math.PI / sides) * i;
        const a2 = (2 * Math.PI / sides) * ((i + 2) % sides);
        const x1 = r * Math.cos(a1);
        const y1 = r * Math.sin(a1);
        const x2 = r * Math.cos(a2);
        const y2 = r * Math.sin(a2);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsl(${(angle * 50) % 360}, 100%, 60%)`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    ctx.restore();
    angle += 0.002;
    requestAnimationFrame(animate);
}
animate();

    async function runAnalysis(S0, sigma, r0, T, E, isCall, isAmerican, optionPriceVal, instrument, isEuro, strikePrice) {
    let result = "<hr><b>Анализ:</b><br>";

    // Форвард
    if (instrument === "Форвард") {
        result += "Инструмент: <b>форвардный контракт</b><br>";
        result += `Ожидаемая цена базового актива к моменту экспирации: <b>${optionPriceVal.toFixed(2)}</b><br>`;
        result += `Ставка: ${(r0 * 100).toFixed(2)}%, волатильность: ${(sigma * 100).toFixed(1)}%<br>`;

        result += "<br><b>Рекомендации:</b><ul>";
        result += "<li>Используйте форвард для хеджирования или спекуляции</li>";
        if (sigma > 0.3) result += "<li>Высокая волатильность — будьте осторожны</li>";
        result += "</ul>";
        document.getElementById("result").innerHTML += result;
        return;
    }

    // Фьючерс
    if (instrument === "Фьючерс") {
        result += "Инструмент: <b>фьючерс</b><br>";
        result += `Текущая оценка справедливой цены: <b>${optionPriceVal.toFixed(2)}</b><br>`;
        result += `Волатильность: ${(sigma * 100).toFixed(1)}%, ставка: ${(r0 * 100).toFixed(2)}%<br>`;

        result += "<br><b>Рекомендации:</b><ul>";
        result += "<li>Фьючерсы ликвидны, подходят для краткосрочной спекуляции</li>";
        if (T < 1) result += "<li>Срок короткий — возможны резкие колебания</li>";
        if (sigma > 0.3) result += "<li>Рынок нестабилен — оцените риски</li>";
        result += "</ul>";
        document.getElementById("result").innerHTML += result;
        return;
    }

    // Опцион
    const intrinsicValue = isCall
        ? Math.max(S0 - strikePrice, 0)
        : Math.max(strikePrice - S0, 0);

    const rawTV = optionPriceVal - intrinsicValue;
    const timeValue = rawTV > 0 ? rawTV : 0;
    const timeValuePct = optionPriceVal > 0 ? timeValue / optionPriceVal * 100 : 0;

    // Анализ исполнения
    let status = "";
    if (intrinsicValue > 0) {
        status = "ITM";
        result += "Опцион <b>в деньгах (ITM)</b><br>";
    } else if (S0 === strikePrice) {
        status = "ATM";
        result += "Опцион <b> при своих (ATM)</b><br>";
    } else if (optionPriceVal === 0) {
        status = "нулевой";
        result += "Опцион <b>не имеет ценности</b> (0.0)<br>";
    } else {
        status = "OTM";
        result += "Опцион <b>вне денег (OTM)</b><br>";
    }

    // Временная стоимость
    if (optionPriceVal === 0) {
        result += "Временная стоимость: <b>недоступна</b><br>";
    } else if (timeValue === 0) {
        result += "Временная стоимость: ≈ <b>0</b><br>";
    } else if (timeValuePct > 60) {
        result += `Временная стоимость: <b>очень высокая</b> (${timeValue.toFixed(2)}, ${timeValuePct.toFixed(1)}%)<br>`;
    } else if (timeValuePct > 30) {
        result += `Временная стоимость: <b>высокая</b> (${timeValue.toFixed(2)}, ${timeValuePct.toFixed(1)}%)<br>`;
    } else if (timeValuePct > 10) {
        result += `Временная стоимость: умеренная (${timeValue.toFixed(2)}, ${timeValuePct.toFixed(1)}%)<br>`;
    } else {
        result += `Временная стоимость: <b>низкая</b> (${timeValue.toFixed(2)}, ${timeValuePct.toFixed(1)}%)<br>`;
    }

    // Волатильность
    if (sigma > 0.4) {
        result += `Волатильность: <b>очень высокая</b> (${(sigma * 100).toFixed(1)}%)<br>`;
    } else if (sigma > 0.2) {
        result += `Волатильность: <b>высокая</b> (${(sigma * 100).toFixed(1)}%)<br>`;
    } else {
        result += `Волатильность: <b>низкая</b> (${(sigma * 100).toFixed(1)}%)<br>`;
    }

    // Срок
    if (T < 0.5) result += "Срок: <b>очень короткий</b><br>";
    else if (T < 1) result += "Срок: <b>короткий</b><br>";
    else if (T < 2) result += "Срок: <b>средний</b><br>";
    else result += "Срок: <b>долгий</b><br>";

  

    // Рекомендации
    result += "<br><b>Рекомендации:</b><ul>";
    if (status === "ITM") result += "<li>Опцион с выигрышем. Опцион приносит прибыль — удерживайте или продавайте</li>";
    if (status === "ATM") result += "<li>Реализация актива не принесет ни прибыли, ни убытков. Опцион по цене контракта, с нулевой внутренней стоимостью.</li>";
    if (status === "OTM") result += "<li>Опцион с проигрышем. Нет внутренней стоимости — оцените риски</li>";
    if (status === "нулевой") result += "<li>Опцион бесполезен — проверьте параметры</li>";
    if (isAmerican) result += "<li>Можно рассмотреть досрочное исполнение</li>";
    if (timeValuePct > 50) result += "<li>Высокая временная стоимость — возможна продажа</li>";
    result += "</ul>";

    document.getElementById("result").innerHTML += result;
}