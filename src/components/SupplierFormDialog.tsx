import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateSupplier } from "@/hooks/useProductData";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  cnpj: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierFormDialog({ open, onOpenChange }: SupplierFormDialogProps) {
  const createSupplier = useCreateSupplier();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", cnpj: "", email: "", phone: "", address: "" },
  });

  const onSubmit = async (values: FormValues) => {
    await createSupplier.mutateAsync({
      name: values.name,
      cnpj: values.cnpj || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: values.address || undefined,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Fornecedor</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input {...field} placeholder="Nome do fornecedor" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cnpj" render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ</FormLabel>
                <FormControl><Input {...field} placeholder="00.000.000/0000-00" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input {...field} type="email" placeholder="email@empresa.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl><Input {...field} placeholder="(11) 99999-9999" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input {...field} placeholder="Endereço completo" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createSupplier.isPending}>
                {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Fornecedor
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
