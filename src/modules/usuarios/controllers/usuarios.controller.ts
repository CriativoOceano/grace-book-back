import { 
    Controller, 
    Get, 
    Post, 
    Body, 
    Patch, 
    Param, 
    Delete, 
    UseGuards,
    Request,
    HttpCode,
    HttpStatus
  } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { CreateUsuarioDto } from '../dto/create-usuario.dto';
import { AdminGuard } from 'src/modules/auth/guards/admin.guard';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { UpdateUsuarioDto } from '../dto/update-usuario.dto';
  
  @Controller('usuarios')
  export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) {}
  
    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() createUsuarioDto: CreateUsuarioDto) {
      return this.usuariosService.create(createUsuarioDto);
    }
  
    @UseGuards(JwtAuthGuard, AdminGuard)
    @Get()
    findAll() {
      return this.usuariosService.findAll();
    }
  
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getProfile(@Request() req) {
      return this.usuariosService.findById(req.user.id);
    }
  
    @UseGuards(JwtAuthGuard, AdminGuard)
    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.usuariosService.findById(id);
    }
  
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto, @Request() req) {
      // Verificar se o usuário está atualizando o próprio perfil ou é um admin
      if (req.user.id !== id && !req.user.isAdmin) {
        return { message: 'Não autorizado a atualizar este usuário' };
      }
      return this.usuariosService.update(id, updateUsuarioDto);
    }
  
    @UseGuards(JwtAuthGuard, AdminGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.usuariosService.remove(id);
    }
  
    @Post('codigo-acesso')
    @HttpCode(HttpStatus.OK)
    solicitarCodigoAcesso(@Body() { identificador }: { identificador: string }) {
      return this.usuariosService.gerarCodigoAcesso(identificador);
    }
  }