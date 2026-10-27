# Projeto TODO

- [x] Aplicar identidade visual CLINIMED com paleta #087A92, #18AFA0 e #4CCB73.
- [x] Renderizar o logotipo saude como SVG inline com símbolo médico abstrato, gradiente e tipografia arredondada.
- [ ] Configurar comunicação do produto usando CLINIMED em telas, notificações e links.
- [ ] Implementar autenticação com perfis Paciente, Operador e Médico.
- [ ] Redirecionar cada perfil ao respectivo painel após autenticação.
- [ ] Implementar bloqueio temporário exatamente após 3 tentativas de login falhas.
- [ ] Implementar recuperação de senha por e-mail com token de validade limitada.
- [x] Criar modelo de dados para clínicas, profissionais, pacientes, especialidades, agendas, horários, agendamentos, pagamentos e notificações.
- [x] Implementar seleção de consulta médica ou exame.
- [ ] Implementar busca de médico ou especialidade com filtros.
- [x] Exibir perfil profissional com CRM, avaliações e valor.
- [ ] Implementar calendário de horários disponíveis.
- [ ] Implementar reserva temporária de horário com duração exata de 10 minutos.
- [x] Exibir resumo de confirmação antes do pagamento.
- [ ] Implementar fluxo de pagamento por Pix e cartão com confirmação antes do registro definitivo do agendamento.
- [ ] Implementar histórico do paciente com status, cancelamento, reagendamento e política de reembolso.
- [ ] Implementar painel do médico com agenda diária e semanal.
- [ ] Implementar relatórios diários e semanais de consultas e pacientes.
- [ ] Implementar painel do operador com agendamento em nome do paciente, cancelamento, reagendamento e visão da agenda da clínica.
- [ ] Preparar notificações por e-mail para confirmação, cancelamento, lembrete de 24 horas e lembrete de 1 hora.
- [x] Manter a integração com WhatsApp fora do escopo ativo desta fase.
- [ ] Validar fluxos críticos com testes Vitest de autenticação, reserva de 10 minutos e confirmação de pagamento.
- [ ] Validar responsividade, acessibilidade, estados de carregamento, erro e vazio.
- [x] Executar verificação de tipos, testes e revisão visual antes do checkpoint final.

## Lacunas identificadas na validação

- [ ] Implementar autenticação real por perfil com validação de credenciais, bloqueio persistente após 3 falhas e recuperação por e-mail/token.
- [ ] Substituir mocks de agendamento por busca filtrável, calendário real, reserva persistente de 10 minutos e confirmação de pagamento no backend.
- [ ] Implementar painéis funcionais de paciente, médico e operador com histórico, política de reembolso, agenda diária/semanal e relatórios reais.
- [x] Manter WhatsApp fora do escopo ativo; notificações atuais permanecem preparadas apenas para e-mail.
- [ ] Adicionar testes de integração dos fluxos críticos e cobertura explícita de loading, erro, vazio e acessibilidade.

## Alteração de escopo — GGL saude

- [x] Renomear a marca exibida na interface, metadados e comunicação para GGL saude.
- [x] Atualizar textos de login, dashboard, rodapé e acessibilidade para GGL saude.
- [x] Retirar a integração com WhatsApp do escopo ativo e manter apenas notificações por e-mail preparadas.
- [x] Atualizar testes e validação visual após a renomeação.

## Perfis de usuário — GGL saude

- [x] Implementar papéis persistentes Médico, Usuário comum/Paciente e Operador.
- [x] Definir permissões por papel no backend e bloquear operações não autorizadas.
- [x] Redirecionar cada papel ao painel correspondente após autenticação.
- [x] Implementar navegação e ações específicas para Paciente, Médico e Operador.
- [x] Criar testes de autorização e isolamento entre os três papéis.
- [x] Validar visualmente os três painéis e atualizar o checkpoint.

## Correções de autorização e ações

- [x] Conectar ações de agenda, pacientes, documentos e relatórios dos painéis de Médico e Operador a comportamentos funcionais.
- [x] Ampliar os testes para cobrir todas as procedures protegidas e bloqueios cruzados entre Paciente, Médico e Operador.

## Correção de autenticação e perfis

- [x] Fazer o seletor de perfil funcionar sem depender de autenticação externa.
- [x] Permitir entrar no painel correspondente ao perfil selecionado.
- [x] Corrigir o botão de login institucional para iniciar a sessão OAuth corretamente.
- [x] Corrigir logout para limpar sessão, perfil local e retornar à tela de acesso.
- [x] Adicionar testes dos fluxos de entrada, seleção de perfil e saída.
- [x] Validar visualmente o fluxo de autenticação e salvar checkpoint.
