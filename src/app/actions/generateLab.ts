'use server';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Instancia a API do Gemini. A chave é buscada em tempo de execução para refletir alterações no .env.local
const getGenAIInstance = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_KEY') {
    throw new Error('GEMINI_API_KEY não foi configurado. Por favor, adicione sua chave ao arquivo .env.local na raiz do projeto.');
  }
  return new GoogleGenerativeAI(apiKey);
};

export interface LabResponse {
  title: string;
  explanationText: string;
  widgetType: 'physics' | 'chart' | 'math-graph';
  widgetConfig: {
    equation: string;
    xLabel: string;
    yLabel: string;
    variables: Array<{
      name: string;
      label: string;
      min: number;
      max: number;
      defaultValue: number;
    }>;
  };
}

/**
 * Server Action para gerar a configuração de um laboratório acadêmico interativo a partir de um tema.
 * Utiliza o modelo gemini-2.5-flash com regras rígidas de saída estruturada em formato JSON.
 */
export async function generateLab(query: string) {
  try {
    const genAI = getGenAIInstance();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction:
        'Você é um motor de inteligência artificial acadêmico e interativo de alta fidelidade. ' +
        'Sua missão é traduzir a dúvida ou tema proposto pelo estudante em um laboratório didático estruturado. ' +
        'Você DEVE explicar o conceito físico, matemático ou estatístico de forma envolvente e configurar um gráfico de curva interativa correspondente. ' +
        'REGRA DE OURO DAS VARIÁVEIS: As `variables` fornecidas no JSON DEVEM ser exclusivamente os conceitos ensinados/mencionados no texto de explicação (ex: se o texto explica a gravidade e o tamanho da bola, as variáveis do slider devem ser "gravity" e "size"). ' +
        'REGRA DE OURO DA EQUAÇÃO: A `equation` deve ser uma fórmula matemática em JavaScript válida que calcula o valor de y com base em x e nas variáveis definidas (ex: "amplitude * Math.sin(frequency * x)" ou "weight * x + bias"). NÃO inclua "y =" no texto da fórmula. Ela deve ser avaliável via new Function("x", ...variaveis, "return " + equacao).',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            title: {
              type: SchemaType.STRING,
              description: 'Título curto e chamativo para o laboratório de experimentos.'
            },
            explanationText: {
              type: SchemaType.STRING,
              description: 'Texto explicativo do conceito de forma didática utilizando formatação Markdown (headings, strong, etc) e instruções diretas de como usar a simulação interativa.'
            },
            widgetType: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['physics', 'chart', 'math-graph'],
              description: 'Tipo de widget visual/interativo que melhor se adequa para representar o conceito e permitir simulação. Use preferencialmente math-graph para fórmulas, gráficos e regressões.'
            },
            widgetConfig: {
              type: SchemaType.OBJECT,
              properties: {
                equation: {
                  type: SchemaType.STRING,
                  description: 'Fórmula matemática/equação em JavaScript válida usando x e os nomes das variáveis (ex: "m * x + b" ou "a * Math.sin(b * x)"). Não adicione "y =" na expressão.'
                },
                xLabel: {
                  type: SchemaType.STRING,
                  description: 'Legenda do eixo X (ex: "Massa (kg)" ou "Tempo (s)").'
                },
                yLabel: {
                  type: SchemaType.STRING,
                  description: 'Legenda do eixo Y (ex: "Força (N)" ou "Velocidade (m/s)").'
                },
                variables: {
                  type: SchemaType.ARRAY,
                  description: 'Sliders de variáveis físicas/matemáticas que mudam o comportamento do gráfico e correspondem aos conceitos da explicação.',
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      name: {
                        type: SchemaType.STRING,
                        description: 'Nome da variável usado na fórmula JS (ex: "m" ou "b" ou "gravity").'
                      },
                      label: {
                        type: SchemaType.STRING,
                        description: 'Nome amigável da variável para o slider da interface (ex: "Gravidade (g)").'
                      },
                      min: {
                        type: SchemaType.NUMBER,
                        description: 'Valor mínimo do slider.'
                      },
                      max: {
                        type: SchemaType.NUMBER,
                        description: 'Valor máximo do slider.'
                      },
                      defaultValue: {
                        type: SchemaType.NUMBER,
                        description: 'Valor padrão inicial do slider.'
                      }
                    },
                    required: ['name', 'label', 'min', 'max', 'defaultValue']
                  }
                }
              },
              required: ['equation', 'xLabel', 'yLabel', 'variables']
            }
          },
          required: ['title', 'explanationText', 'widgetType', 'widgetConfig']
        }
      }
    });

    const response = await model.generateContent(
      `Crie um laboratório interativo inovador e didático focado no seguinte tema/questão: "${query}". ` +
      `Lembre-se das REGRAS DE OURO: mapeie as variáveis matemáticas/físicas explicadas na teoria diretamente nos parâmetros do widgetConfig.variables, e monte a equation em JavaScript válido usando essas variáveis.`
    );

    const responseText = response.response.text();
    if (!responseText) {
      throw new Error('O modelo gerador retornou uma resposta em branco.');
    }

    const data = JSON.parse(responseText) as LabResponse;
    return {
      success: true,
      data
    };
  } catch (error: any) {
    console.error('[generateLab] Erro ao chamar a API do Gemini:', error);
    return {
      success: false,
      error: error.message || 'Erro inesperado ao gerar o laboratório interativo.'
    };
  }
}
