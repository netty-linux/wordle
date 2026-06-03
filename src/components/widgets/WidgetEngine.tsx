'use client';

import React, { useState, useEffect } from 'react';

interface Variable {
  name: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}

interface WidgetConfig {
  equation: string;
  xLabel: string;
  yLabel: string;
  variables: Variable[];
}

interface WidgetEngineProps {
  type: string;
  config: WidgetConfig;
}

/**
 * Avalia de forma segura a equação matemática informada pelo Gemini no contexto do browser.
 * Injeta x e todas as variáveis de sliders como argumentos na execução da fórmula.
 */
const evaluateEquation = (equationStr: string, xVal: number, variables: { [key: string]: number }): number => {
  try {
    const varNames = Object.keys(variables);
    const varValues = Object.values(variables);
    
    // Cria uma função injetando x e as variáveis como parâmetros dinâmicos
    const fn = new Function('x', ...varNames, `return ${equationStr};`);
    const res = fn(xVal, ...varValues);
    
    if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
      return res;
    }
    return 0;
  } catch (error) {
    // Falha silenciosa durante as drags do slider para não quebrar a tela
    return 0;
  }
};

export function WidgetEngine({ type, config }: WidgetEngineProps) {
  // Fallbacks caso a chamada venha vazia ou com formato incorreto
  const fallbackVariables: Variable[] = [
    { name: 'm', label: 'Inclinação (m)', min: -5, max: 5, defaultValue: 1 },
    { name: 'b', label: 'Intercepto (b)', min: -100, max: 100, defaultValue: 0 }
  ];

  const variablesList = config?.variables && Array.isArray(config.variables) 
    ? config.variables 
    : fallbackVariables;

  const equation = config?.equation || 'm * x + b';
  const xLabel = config?.xLabel || 'Eixo X';
  const yLabel = config?.yLabel || 'Eixo Y';

  // 1. Inicializa estado dinâmico dos sliders
  const [values, setValues] = useState<{ [key: string]: number }>(() => {
    const initial: { [key: string]: number } = {};
    variablesList.forEach((v) => {
      initial[v.name] = v.defaultValue;
    });
    return initial;
  });

  const handleSliderChange = (name: string, val: number) => {
    setValues((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  // 2. Dimensões do Gráfico SVG
  const width = 500;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;

  // 3. Define escalas do gráfico
  // O X sempre vai de -10 a 10. Assim, a escala X é constante
  const scaleX = 200 / 10; // 200 pixels representam 10 unidades matemáticas

  // A escala Y adapta-se ao valor máximo suportado pelos sliders para evitar transbordamento
  let maxSliderLimit = 10;
  variablesList.forEach(v => {
    const limit = Math.max(Math.abs(v.min), Math.abs(v.max));
    if (limit > maxSliderLimit) {
      maxSliderLimit = limit;
    }
  });
  const scaleY = 160 / maxSliderLimit; // Escala ajustada dinamicamente

  // 4. Calcula os pontos da curva matemática para renderizar o path SVG
  const points: string[] = [];
  // Gera 120 pontos entre x = -10 e x = 10 para uma curva extremamente lisa
  for (let xMat = -10; xMat <= 10; xMat += 0.16) {
    const yVal = evaluateEquation(equation, xMat, values);
    const xPix = centerX + xMat * scaleX;
    const yPix = centerY - yVal * scaleY;
    
    // Filtra pontos inválidos ou excessivamente fora da área visível
    if (!isNaN(yPix) && isFinite(yPix) && yPix >= -200 && yPix <= height + 200) {
      points.push(`${xPix.toFixed(1)},${yPix.toFixed(1)}`);
    }
  }
  const pathD = points.length > 1 ? `M ${points.join(' L ')}` : '';

  // 5. Linhas de grade do plano de fundo cartesiano
  const vGridLines = [-8, -6, -4, -2, 2, 4, 6, 8];
  const hGridLines = [-8, -6, -4, -2, 2, 4, 6, 8];

  return (
    <div className="w-full flex flex-col md:flex-row gap-6 font-sans">
      {/* Painel Esquerdo: Controles */}
      <div className="w-full md:w-80 bg-white border-4 border-black p-6 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-6 select-none">
        <div className="border-b-4 border-black pb-3">
          <h3 className="text-xl font-black uppercase tracking-wider text-black">
            Variáveis
          </h3>
        </div>
        <div className="flex flex-col gap-6">
          {variablesList.map((v) => {
            const currentVal = values[v.name] ?? v.defaultValue;
            return (
              <div key={v.name} className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-lg font-bold text-black">
                  <span>{v.label}</span>
                  <span className="font-mono bg-white text-black border-4 border-black px-3 py-1 rounded-xl text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                    {currentVal.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={v.min}
                  max={v.max}
                  step={(v.max - v.min) / 100 || 0.1}
                  value={currentVal}
                  onChange={(e) => handleSliderChange(v.name, parseFloat(e.target.value))}
                  className="w-full h-4 bg-zinc-100 border-3 border-black rounded-lg appearance-none cursor-pointer accent-black"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel Direito: O Gráfico */}
      <div className="flex-1 bg-white border-4 border-black rounded-2xl relative overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center p-6 min-h-[380px] h-[400px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full relative z-10 select-none">
          {/* Grade cartesiana leve */}
          {vGridLines.map((tick) => (
            <line
              key={`v-grid-${tick}`}
              x1={centerX + tick * scaleX}
              y1="40"
              x2={centerX + tick * scaleX}
              y2="360"
              stroke="#e4e4e7"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          ))}
          {hGridLines.map((tick) => (
            <line
              key={`h-grid-${tick}`}
              x1="40"
              y1={centerY - tick * scaleY}
              x2="460"
              y2={centerY - tick * scaleY}
              stroke="#e4e4e7"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          ))}

          {/* Eixos X e Y Principais */}
          <line x1="30" y1={centerY} x2="470" y2={centerY} stroke="black" strokeWidth="3" />
          <line x1={centerX} y1="30" x2={centerX} y2={370} stroke="black" strokeWidth="3" />

          {/* Marcações de Ticks e valores numéricos dos Eixos */}
          {vGridLines.map((tick) => (
            <g key={`x-tick-${tick}`}>
              <line
                x1={centerX + tick * scaleX}
                y1={centerY - 6}
                x2={centerX + tick * scaleX}
                y2={centerY + 6}
                stroke="black"
                strokeWidth="2.5"
              />
              <text
                x={centerX + tick * scaleX}
                y={centerY + 25}
                textAnchor="middle"
                className="font-mono text-base fill-zinc-600 font-bold"
              >
                {tick}
              </text>
            </g>
          ))}
          {hGridLines.map((tick) => {
            const mathYValue = tick * (maxSliderLimit / 10);
            return (
              <g key={`y-tick-${tick}`}>
                <line
                  x1={centerX - 6}
                  y1={centerY - tick * scaleY}
                  x2={centerX + 6}
                  y2={centerY - tick * scaleY}
                  stroke="black"
                  strokeWidth="2.5"
                />
                <text
                  x={centerX - 15}
                  y={centerY - tick * scaleY + 6}
                  textAnchor="end"
                  className="font-mono text-base fill-zinc-600 font-bold"
                >
                  {mathYValue.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Plotagem da Curva Matemática Dinâmica */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#ea580c" // Laranja vibrante
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Legendas dos Eixos em fontes grandes e legíveis */}
          <text
            x="475"
            y={centerY + 6}
            textAnchor="start"
            className="font-bold fill-black text-lg font-sans"
          >
            {xLabel}
          </text>
          <text
            x={centerX}
            y="22"
            textAnchor="middle"
            className="font-bold fill-black text-lg font-sans"
          >
            {yLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}
