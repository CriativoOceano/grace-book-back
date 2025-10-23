import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ConfiguracaoModel } from '../schemas/config.schema';
import { getModelToken } from '@nestjs/mongoose';

async function seedConteudo() {

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const configuracaoModel = app.get<ConfiguracaoModel>(getModelToken('Configuracao'));

    // Verificar se já existe configuração
    const configExistente = await configuracaoModel.findOne();
    
    if (configExistente) {
      
      // Verificar se já tem conteúdo do site
      if (configExistente.conteudoSite && 
          configExistente.conteudoSite.heroSlides && 
          configExistente.conteudoSite.heroSlides.length > 0) {
        await app.close();
        return;
      }
      
      // Atualizar configuração existente com conteúdo do site
      configExistente.conteudoSite = {
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
      };
      
      await configExistente.save();
    } else {
      await configuracaoModel.getConfig();
    }

    await app.close();
    
  } catch (error) {
    process.exit(1);
  }
}

// Executar o seed se este arquivo for executado diretamente
if (require.main === module) {
  seedConteudo();
}

export { seedConteudo };
