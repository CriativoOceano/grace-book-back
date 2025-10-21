import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';

export type ConfiguracaoDocument = Configuracao & Document;

// Interface para definir métodos estáticos
export interface ConfiguracaoModel extends Model<ConfiguracaoDocument> {
  getConfig(): Promise<ConfiguracaoDocument>;
}

// Interface para faixa de preços por quantidade de pessoas
export class FaixaPreco {
  @Prop({ required: true })
  maxPessoas: number;

  @Prop({ required: true, type: Number, min: 0 })
  valor: number;
}

// Interface para slide do carousel hero
export class HeroSlide {
  @Prop({ required: true })
  image: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  subtitle: string;

  @Prop({ required: true })
  cta: string;

  @Prop({ required: true })
  alt: string;
}

// Interface para imagem da galeria
export class GalleryImage {
  @Prop({ required: true })
  thumbnail: string;

  @Prop({ required: true })
  full: string;

  @Prop({ required: true })
  alt: string;

  @Prop({ required: true })
  title: string;
}

// Interface para imagem dos chalés
export class ChaletImage {
  @Prop({ required: true })
  src: string;

  @Prop({ required: true })
  alt: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;
}

// Interface para imagem simples
export class SimpleImage {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  alt: string;
}

// Interface para conteúdo do site
export class ConteudoSite {
  @Prop({ type: [HeroSlide], default: [] })
  heroSlides: HeroSlide[];

  @Prop({ type: [GalleryImage], default: [] })
  galleryImages: GalleryImage[];

  @Prop({ type: [ChaletImage], default: [] })
  chaletImages: ChaletImage[];

  @Prop({ type: SimpleImage })
  aboutImage: SimpleImage;

  @Prop({ type: SimpleImage })
  baptismImage: SimpleImage;
}

@Schema({ timestamps: true })
export class Configuracao {
  @Prop({ type: [Object], required: true })
  precoDiaria: FaixaPreco[];

  @Prop({ required: true, type: Number, min: 0 })
  precoChale: number;

  @Prop({ required: true, type: Number, min: 0 })
  precoBatismo: number;

  @Prop({ required: true, type: Number, min: 1, default: 4 })
  quantidadeMaximaChales: number;

  @Prop({ required: true, type: Number, min: 1, default: 200 })
  qtdMaxPessoas: number;

  @Prop({ required: true, type: Number, min: 0, default: 2 })
  diasAntecedenciaMinima: number;

  @Prop({ required: true })
  emailRemetente: string;

  @Prop({ default: false })
  manutencao: boolean;

  @Prop({ type: String })
  asaasApiKey: string;

  @Prop({ type: String, default: 'https://sandbox.asaas.com/api/v3' })
  asaasUrl: string;

  @Prop({ type: Date, default: Date.now })
  dataAtualizacao: Date;

  @Prop({ type: ConteudoSite, default: {} })
  conteudoSite: ConteudoSite;

  @Prop({ type: String, required: true })
  adminAccessCode: string;
}

export const ConfiguracaoSchema = SchemaFactory.createForClass(Configuracao);

// Garantir que sempre exista uma configuração padrão no sistema
ConfiguracaoSchema.statics.getConfig = async function() {
  // Buscar configuração existente ou criar uma padrão
  const config = await this.findOne();
  
  if (config) {
    return config;
  }
  
  // Configuração padrão
  const defaultConfig = {
    precoDiaria: [
      { maxPessoas: 30, valor: 1000 },
      { maxPessoas: 60, valor: 1500 },
      { maxPessoas: 100, valor: 2000 },
      { maxPessoas: 200, valor: 2500 }
    ],
    precoChale: 150,
    precoBatismo: 300,
    quantidadeMaximaChales: 4,
    diasAntecedenciaMinima: 2,
    qtdMaxPessoas: 200,
    emailRemetente: 'reservas@fontedagraca.com.br',
    manutencao: false,
    asaasApiKey: '',
    asaasUrl: 'https://sandbox.asaas.com/api/v3',
    adminAccessCode: '$2b$10$k7LYaWhu/STgumjPBuwRzeNTEuw0rqsbAFUlhE9jJACKvnNgjfU9m', // Hash do admin123
    conteudoSite: {
      heroSlides: [
        {
          image: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&h=1080&fit=crop',
          title: 'Viva dias de descanso e conexão',
          subtitle: 'A natureza e o propósito em perfeita harmonia.',
          cta: 'Reservar agora',
          alt: 'Paisagem natural com lago e montanhas'
        },
        {
          image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
          title: 'Experiências que renovam corpo e alma',
          subtitle: 'Hospede-se, relaxe e desfrute de cada momento.',
          cta: 'Fazer minha reserva',
          alt: 'Chalés aconchegantes em meio à natureza'
        },
        {
          image: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop',
          title: 'O lugar ideal para retiros, batismos e encontros especiais',
          subtitle: 'Estrutura completa, natureza viva e hospitalidade incomparável.',
          cta: 'Reservar sua data',
          alt: 'Cerimônia de batismo ao ar livre'
        }
      ],
      galleryImages: [
        {
          thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=800&fit=crop',
          alt: 'Chalés aconchegantes em meio à natureza',
          title: 'Chalés Aconchegantes'
        },
        {
          thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&h=800&fit=crop',
          alt: 'Vista panorâmica da sede campestre',
          title: 'Vista Panorâmica'
        },
        {
          thumbnail: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=800&fit=crop',
          alt: 'Lago sereno para contemplação',
          title: 'Lago Sereno'
        },
        {
          thumbnail: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&h=800&fit=crop',
          alt: 'Cerimônia de batismo ao ar livre',
          title: 'Cerimônias Especiais'
        },
        {
          thumbnail: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&h=800&fit=crop',
          alt: 'Piscina e área de lazer',
          title: 'Área de Lazer'
        },
        {
          thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=450&fit=crop',
          full: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=800&fit=crop',
          alt: 'Salão de eventos e reuniões',
          title: 'Salão de Eventos'
        }
      ],
      chaletImages: [
        {
          src: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop',
          alt: 'Chalé 1 - Vista externa',
          title: 'Chalé Familiar',
          description: 'Chalé aconchegante ideal para famílias, com vista para o jardim e todas as comodidades necessárias para uma estadia confortável.'
        },
        {
          src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=600&fit=crop',
          alt: 'Chalé 2 - Interior',
          title: 'Chalé Executivo',
          description: 'Chalé moderno e elegante, perfeito para executivos que buscam conforto e praticidade durante sua estadia.'
        },
        {
          src: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=600&fit=crop',
          alt: 'Chalé 3 - Vista panorâmica',
          title: 'Chalé Premium',
          description: 'Nosso chalé mais luxuoso, com vista panorâmica e todas as amenidades premium para uma experiência única.'
        },
        {
          src: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
          alt: 'Chalé 4 - Área externa',
          title: 'Chalé Rústico',
          description: 'Chalé com estilo rústico e charmoso, ideal para quem busca uma experiência mais próxima da natureza.'
        }
      ],
      aboutImage: {
        url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
        alt: 'Sede campestre - Vista panorâmica'
      },
      baptismImage: {
        url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop',
        alt: 'Cerimônia de batismo ao ar livre'
      }
    }
  };
  
  return this.create(defaultConfig);
};